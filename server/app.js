import crypto from 'node:crypto';
import express from 'express';

const STATE_KEY = 'dashboard';
const TEMPLATE_KEY = 'snapshot_template';
const RANGE_DAYS = { '30d': 30, '90d': 90, '180d': 180, '1y': 365 };
const TRIGGERS = ['manual', 'scheduled', 'milestone'];
const OWNERSHIP = ['sre_full', 'shared', 'dev_owned'];
const SLO = ['healthy', 'warning', 'exhausted'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const bit = (v) => (v ? 1 : 0);

function validateSnapshot(body) {
  if (!isObject(body)) return 'Body must be an object';
  const triggerType = body.triggerType ?? 'manual';
  if (!TRIGGERS.includes(triggerType)) return 'Invalid triggerType';
  const m = body.metrics;
  if (!isObject(m)) return 'metrics is required';
  for (const k of [
    'totalContractedHours',
    'totalOperationalHours',
    'macroLoadPercentage',
    'teamsInRedZone',
    'unhedgedDeficitHours',
    'totalHiringCost',
  ]) {
    if (!isNum(m[k])) return `metrics.${k} must be a number`;
  }
  if (!Array.isArray(body.teams)) return 'teams must be an array';
  for (const t of body.teams) {
    if (!isObject(t) || typeof t.teamId !== 'string' || typeof t.teamName !== 'string') return 'Invalid team entry';
    for (const k of [
      'fteCount',
      'weeklyHours',
      'effectiveCapacityPercentage',
      'annualSalaryBaseline',
      'contractedHours',
      'operationalHours',
      'loadPercentage',
      'deficitHours',
      'hiringCost',
    ]) {
      if (!isNum(t[k])) return `teams[].${k} must be a number`;
    }
  }
  const services = body.services ?? [];
  if (!Array.isArray(services)) return 'services must be an array';
  for (const s of services) {
    if (!isObject(s) || typeof s.serviceId !== 'string' || typeof s.teamId !== 'string' || typeof s.name !== 'string') {
      return 'Invalid service entry';
    }
    for (const k of ['deployHours', 'maintenanceHours', 'criticalityWeight', 'requiredHours']) {
      if (!isNum(s[k])) return `services[].${k} must be a number`;
    }
    if (!OWNERSHIP.includes(s.ownershipModel)) return 'Invalid service ownershipModel';
    if (!SLO.includes(s.sloStatus)) return 'Invalid service sloStatus';
  }
  return null;
}

/** Inserts a snapshot with its team/service rows atomically; returns the new id. */
export function insertSnapshot(db, body) {
  const id = crypto.randomUUID();
  const m = body.metrics;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO snapshots (id, trigger_type, label, total_contracted_hours, total_operational_hours,
         macro_load_percentage, teams_in_red_zone, unhedged_deficit_hours, total_hiring_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.triggerType ?? 'manual',
      body.label ?? null,
      m.totalContractedHours,
      m.totalOperationalHours,
      m.macroLoadPercentage,
      m.teamsInRedZone,
      m.unhedgedDeficitHours,
      m.totalHiringCost,
    );
    const insTeam = db.prepare(
      `INSERT INTO snapshot_teams (snapshot_id, team_id, team_name, fte_count, weekly_hours,
         effective_capacity_percentage, annual_salary_baseline, contracted_hours, operational_hours,
         load_percentage, is_red_zone, deficit_hours, hiring_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const t of body.teams) {
      insTeam.run(
        id, t.teamId, t.teamName, t.fteCount, t.weeklyHours, t.effectiveCapacityPercentage,
        t.annualSalaryBaseline, t.contractedHours, t.operationalHours, t.loadPercentage,
        bit(t.isRedZone), t.deficitHours, t.hiringCost,
      );
    }
    const insSvc = db.prepare(
      `INSERT INTO snapshot_services (snapshot_id, service_id, team_id, name, deploy_hours, maintenance_hours,
         criticality_weight, is_automated, has_expertise, ownership_model, prr_approved, slo_status,
         is_active, required_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of body.services ?? []) {
      insSvc.run(
        id, s.serviceId, s.teamId, s.name, s.deployHours, s.maintenanceHours, s.criticalityWeight,
        bit(s.isAutomated), bit(s.hasExpertise), s.ownershipModel, bit(s.prrApproved), s.sloStatus,
        bit(s.isActive), s.requiredHours,
      );
    }
    db.prepare(
      `INSERT INTO active_state (key, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    ).run(TEMPLATE_KEY, JSON.stringify(body));
  });
  tx();
  return id;
}

/**
 * Takes a scheduled snapshot from the most recently submitted snapshot payload
 * when no snapshot has been recorded in the last `intervalDays` days.
 */
export function captureScheduledSnapshot(db, intervalDays = 7) {
  const template = db.prepare('SELECT payload FROM active_state WHERE key = ?').get(TEMPLATE_KEY);
  if (!template) return null;
  const recent = db
    .prepare(`SELECT 1 FROM snapshots WHERE created_at >= datetime('now', '-' || ? || ' days') LIMIT 1`)
    .get(intervalDays);
  if (recent) return null;
  return insertSnapshot(db, { ...JSON.parse(template.payload), triggerType: 'scheduled', label: 'Weekly snapshot' });
}

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/state', (_req, res) => {
    const row = db.prepare('SELECT payload, updated_at FROM active_state WHERE key = ?').get(STATE_KEY);
    if (!row) return res.status(404).json({ error: 'No state saved' });
    res.json({ state: JSON.parse(row.payload), updatedAt: row.updated_at });
  });

  app.put('/api/state', (req, res) => {
    const state = req.body?.state ?? req.body;
    if (!isObject(state) || !isObject(state.globalConfig) || !Array.isArray(state.services)) {
      return res.status(400).json({ error: 'Invalid state: globalConfig and services are required' });
    }
    db.prepare(
      `INSERT INTO active_state (key, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    ).run(STATE_KEY, JSON.stringify(state));
    res.json({ ok: true });
  });

  app.post('/api/snapshots', (req, res) => {
    const error = validateSnapshot(req.body);
    if (error) return res.status(400).json({ error });
    res.status(201).json({ id: insertSnapshot(db, req.body) });
  });

  app.get('/api/snapshots', (req, res) => {
    const range = req.query.range ?? '30d';
    const days = RANGE_DAYS[range];
    if (!days) return res.status(400).json({ error: 'range must be one of 30d, 90d, 180d, 1y' });
    const teamId = typeof req.query.teamId === 'string' && req.query.teamId !== 'all' ? req.query.teamId : null;

    const rows = teamId
      ? db
          .prepare(
            `SELECT s.id, s.created_at, s.trigger_type, s.label, t.load_percentage, t.operational_hours,
                    t.contracted_hours, t.is_red_zone, t.deficit_hours, t.hiring_cost,
                    (SELECT COUNT(*) FROM snapshot_services v WHERE v.snapshot_id = s.id AND v.team_id = t.team_id AND v.is_active = 1) AS active_services,
                    (SELECT COUNT(*) FROM snapshot_services v WHERE v.snapshot_id = s.id AND v.team_id = t.team_id AND v.is_active = 1 AND v.slo_status = 'healthy') AS healthy_services
             FROM snapshots s JOIN snapshot_teams t ON t.snapshot_id = s.id AND t.team_id = ?
             WHERE s.created_at >= datetime('now', '-' || ? || ' days')
             ORDER BY s.created_at ASC, s.rowid ASC`,
          )
          .all(teamId, days)
      : db
          .prepare(
            `SELECT s.id, s.created_at, s.trigger_type, s.label, s.macro_load_percentage AS load_percentage,
                    s.total_operational_hours AS operational_hours, s.total_contracted_hours AS contracted_hours,
                    (s.teams_in_red_zone > 0) AS is_red_zone, s.unhedged_deficit_hours AS deficit_hours,
                    s.total_hiring_cost AS hiring_cost,
                    (SELECT COUNT(*) FROM snapshot_services v WHERE v.snapshot_id = s.id AND v.is_active = 1) AS active_services,
                    (SELECT COUNT(*) FROM snapshot_services v WHERE v.snapshot_id = s.id AND v.is_active = 1 AND v.slo_status = 'healthy') AS healthy_services,
                    s.teams_in_red_zone
             FROM snapshots s
             WHERE s.created_at >= datetime('now', '-' || ? || ' days')
             ORDER BY s.created_at ASC, s.rowid ASC`,
          )
          .all(days);

    res.json({
      range,
      teamId: teamId ?? 'all',
      points: rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        triggerType: r.trigger_type,
        label: r.label,
        operationalLoadPercentage: r.load_percentage,
        toilHours: r.operational_hours,
        contractedHours: r.contracted_hours,
        isRedZone: Boolean(r.is_red_zone),
        ...(r.teams_in_red_zone !== undefined && { teamsInRedZone: r.teams_in_red_zone }),
        deficitHours: r.deficit_hours,
        hiringCost: r.hiring_cost,
        errorBudgetCompliance: r.active_services > 0 ? r.healthy_services / r.active_services : 1,
      })),
    });
  });

  return app;
}
