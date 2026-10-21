// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, captureScheduledSnapshot } from './app.js';
import { openDatabase, pruneOldSnapshots } from './db.js';

const snapshot = (overrides = {}) => ({
  triggerType: 'manual',
  label: 'Q1',
  metrics: {
    totalContractedHours: 80, totalOperationalHours: 30, macroLoadPercentage: 0.375,
    teamsInRedZone: 0, unhedgedDeficitHours: 0, totalHiringCost: 0,
  },
  teams: [{
    teamId: 'a', teamName: 'A', fteCount: 2, weeklyHours: 40, effectiveCapacityPercentage: 0.8,
    annualSalaryBaseline: 150000, contractedHours: 80, operationalHours: 30, loadPercentage: 0.375,
    isRedZone: false, deficitHours: 0, hiringCost: 0,
  }],
  services: [{
    serviceId: 's1', teamId: 'a', name: 'DB', deployHours: 1, maintenanceHours: 2, criticalityWeight: 1,
    isAutomated: false, hasExpertise: true, ownershipModel: 'sre_full', prrApproved: true,
    sloStatus: 'warning', isActive: true, requiredHours: 3,
  }],
  ...overrides,
});

describe('persistence API', () => {
  let db, server, base;
  beforeAll(async () => {
    db = openDatabase(':memory:');
    server = createApp(db).listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(() => server.close());

  const call = (path, method = 'GET', body) =>
    fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });

  it('enables foreign keys', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('round-trips live state', async () => {
    expect((await call('/api/state')).status).toBe(404);
    const state = { globalConfig: { fteCount: 2 }, services: [], teams: [] };
    expect((await call('/api/state', 'PUT', { state })).status).toBe(200);
    expect((await (await call('/api/state')).json()).state).toEqual(state);
    expect((await call('/api/state', 'PUT', { nope: 1 })).status).toBe(400);
  });

  it('records snapshots and serves trends', async () => {
    expect((await call('/api/snapshots', 'POST', { triggerType: 'manual' })).status).toBe(400);
    expect((await call('/api/snapshots', 'POST', snapshot())).status).toBe(201);
    const all = await (await call('/api/snapshots?range=30d')).json();
    expect(all.points).toHaveLength(1);
    expect(all.points[0].toilHours).toBe(30);
    expect(all.points[0].errorBudgetCompliance).toBe(0);
    const team = await (await call('/api/snapshots?range=1y&teamId=a')).json();
    expect(team.points[0].operationalLoadPercentage).toBe(0.375);
    expect((await (await call('/api/snapshots?teamId=zzz')).json()).points).toHaveLength(0);
    expect((await call('/api/snapshots?range=2y')).status).toBe(400);
  });

  it('prunes old snapshots with cascade and honours windows', async () => {
    await call('/api/snapshots', 'POST', snapshot());
    db.prepare(`UPDATE snapshots SET created_at = datetime('now', '-400 days') WHERE rowid = (SELECT MIN(rowid) FROM snapshots)`).run();
    expect(pruneOldSnapshots(db)).toBe(1);
    expect(db.prepare('SELECT COUNT(*) c FROM snapshot_teams').get().c).toBe(1);
    db.prepare(`UPDATE snapshots SET created_at = datetime('now', '-100 days')`).run();
    expect((await (await call('/api/snapshots?range=90d')).json()).points).toHaveLength(0);
    expect((await (await call('/api/snapshots?range=180d')).json()).points).toHaveLength(1);
  });

  it('captures scheduled snapshots only when stale', () => {
    expect(captureScheduledSnapshot(db)).not.toBeNull();
    expect(captureScheduledSnapshot(db)).toBeNull();
  });
});
