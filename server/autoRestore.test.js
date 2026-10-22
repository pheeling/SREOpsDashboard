// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSnapshot } from './app.js';
import { openDatabase } from './db.js';
import { executeScheduledRestore, initAutoRestoreScheduler } from './services/autoRestore.js';

const body = {
  triggerType: 'manual',
  label: 'golden',
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
};

const cfg = (over = {}) => ({
  AUTO_RESTORE_ENABLED: true, RESTORE_CRON_SCHEDULE: '0 */6 * * *',
  TARGET_SNAPSHOT_ID: 'x', AUDIT_LOG_NOTE: 'test', ...over,
});

describe('auto restore', () => {
  let db, id;
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db = openDatabase(':memory:');
    id = insertSnapshot(db, body);
    db.prepare(`INSERT INTO active_state (key, payload) VALUES ('dashboard', '{"tampered":true}')`).run();
  });

  it('restores state and writes an audit entry when enabled', () => {
    const result = executeScheduledRestore(db, cfg({ TARGET_SNAPSHOT_ID: id }));
    expect(result).toEqual({ executed: true, targetId: id });
    const state = JSON.parse(db.prepare(`SELECT payload FROM active_state WHERE key = 'dashboard'`).get().payload);
    expect(state.teams[0]).toMatchObject({ id: 'a', fteCount: 2 });
    expect(state.services[0]).toMatchObject({ id: 's1', teamId: 'a', isActive: true });
    expect(state.globalConfig).toMatchObject({ fteCount: 2, weeklyHours: 40, capacityEfficiencyFactor: 0.8 });
    const log = db.prepare('SELECT * FROM audit_log').all();
    expect(log).toHaveLength(1);
    expect(log[0].trigger_type).toBe('automated_self_healing');
    expect(log[0].message).toContain(`[AUTO-RESTORE] Reverted to snapshot ${id}`);
  });

  it('does nothing when disabled in code', () => {
    const result = executeScheduledRestore(db, cfg({ AUTO_RESTORE_ENABLED: false, TARGET_SNAPSHOT_ID: id }));
    expect(result).toEqual({ executed: false, reason: 'DISABLED_IN_CODE' });
    expect(db.prepare(`SELECT payload FROM active_state WHERE key = 'dashboard'`).get().payload).toBe('{"tampered":true}');
    expect(db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n).toBe(0);
  });

  it('rolls back and leaves state untouched when the snapshot is missing', () => {
    const result = executeScheduledRestore(db, cfg({ TARGET_SNAPSHOT_ID: 'missing' }));
    expect(result.executed).toBe(false);
    expect(db.prepare(`SELECT payload FROM active_state WHERE key = 'dashboard'`).get().payload).toBe('{"tampered":true}');
    expect(db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n).toBe(0);
  });

  it('schedules the job only when enabled', () => {
    const scheduler = { schedule: vi.fn() };
    initAutoRestoreScheduler(db, cfg({ AUTO_RESTORE_ENABLED: false }), scheduler);
    expect(scheduler.schedule).not.toHaveBeenCalled();
    initAutoRestoreScheduler(db, cfg({ TARGET_SNAPSHOT_ID: id }), scheduler);
    expect(scheduler.schedule).toHaveBeenCalledWith('0 */6 * * *', expect.any(Function));
    scheduler.schedule.mock.calls[0][1]();
    expect(db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n).toBe(1);
  });
});
