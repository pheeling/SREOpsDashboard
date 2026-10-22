import cron from 'node-cron';
import { RESTORE_CONFIG } from '../config/restoreConfig.js';

const STATE_KEY = 'dashboard';

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

/** Rebuilds the live dashboard state from a snapshot's team and service rows. */
function buildState(teams, services) {
  const fteCount = sum(teams, (t) => t.fte_count);
  const contracted = sum(teams, (t) => t.fte_count * t.weekly_hours);
  const first = teams[0];
  return {
    globalConfig: {
      fteCount,
      weeklyHours: fteCount > 0 ? contracted / fteCount : first.weekly_hours,
      capacityEfficiencyFactor:
        contracted > 0
          ? sum(teams, (t) => t.fte_count * t.weekly_hours * t.effective_capacity_percentage) / contracted
          : first.effective_capacity_percentage,
      annualSalary:
        fteCount > 0
          ? sum(teams, (t) => t.fte_count * t.annual_salary_baseline) / fteCount
          : first.annual_salary_baseline,
    },
    teams: teams.map((t) => ({
      id: t.team_id,
      name: t.team_name,
      fteCount: t.fte_count,
      weeklyHours: t.weekly_hours,
      effectiveCapacityPercentage: t.effective_capacity_percentage,
      annualSalaryBaseline: t.annual_salary_baseline,
    })),
    services: services.map((s) => ({
      id: s.service_id,
      teamId: s.team_id,
      name: s.name,
      deployHours: s.deploy_hours,
      maintenanceHours: s.maintenance_hours,
      weight: s.criticality_weight,
      isAutomated: Boolean(s.is_automated),
      hasExpertise: Boolean(s.has_expertise),
      ownershipModel: s.ownership_model,
      prrApproved: Boolean(s.prr_approved),
      sloStatus: s.slo_status,
      isActive: Boolean(s.is_active),
    })),
    selectedTeamId: 'all',
  };
}

/**
 * Atomically overwrites the live state with the configured golden snapshot and
 * appends an audit_log entry. Any failure rolls the whole transaction back.
 */
export function executeScheduledRestore(db, config = RESTORE_CONFIG) {
  if (!config.AUTO_RESTORE_ENABLED) {
    console.log('[AutoRestore] Routine skipped: disabled by code configuration.');
    return { executed: false, reason: 'DISABLED_IN_CODE' };
  }

  const targetId = config.TARGET_SNAPSHOT_ID;
  try {
    db.transaction(() => {
      const snapshot = db.prepare('SELECT id FROM snapshots WHERE id = ?').get(targetId);
      if (!snapshot) throw new Error(`Target snapshot '${targetId}' does not exist.`);
      const teams = db.prepare('SELECT * FROM snapshot_teams WHERE snapshot_id = ? ORDER BY id').all(targetId);
      const services = db.prepare('SELECT * FROM snapshot_services WHERE snapshot_id = ? ORDER BY id').all(targetId);
      if (teams.length === 0) throw new Error(`Target snapshot '${targetId}' has no teams.`);

      db.prepare(
        `INSERT INTO active_state (key, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      ).run(STATE_KEY, JSON.stringify(buildState(teams, services)));

      db.prepare('INSERT INTO audit_log (trigger_type, snapshot_id, message) VALUES (?, ?, ?)').run(
        'automated_self_healing',
        targetId,
        `[AUTO-RESTORE] Reverted to snapshot ${targetId}: ${config.AUDIT_LOG_NOTE}`,
      );
    })();
    console.log(`[AutoRestore] Successfully restored live state to '${targetId}'.`);
    return { executed: true, targetId };
  } catch (err) {
    console.error('[AutoRestore] Restore failed:', err.message);
    return { executed: false, error: err.message };
  }
}

/** Starts the in-process cron job; exposes no HTTP surface. */
export function initAutoRestoreScheduler(db, config = RESTORE_CONFIG, scheduler = cron) {
  if (!config.AUTO_RESTORE_ENABLED) {
    console.log('[AutoRestore] Routine skipped: disabled by code configuration.');
    return null;
  }
  console.log(`[AutoRestore] Scheduler active: running on cron '${config.RESTORE_CRON_SCHEDULE}'.`);
  return scheduler.schedule(config.RESTORE_CRON_SCHEDULE, () => {
    // Re-evaluate the code gate on every execution cycle.
    executeScheduledRestore(db, config);
  });
}
