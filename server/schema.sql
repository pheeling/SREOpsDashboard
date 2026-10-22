PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS active_state (
  key TEXT PRIMARY KEY,
  payload JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trigger_type TEXT CHECK(trigger_type IN ('manual', 'scheduled', 'milestone')) NOT NULL,
  label TEXT,
  total_contracted_hours REAL NOT NULL,
  total_operational_hours REAL NOT NULL,
  macro_load_percentage REAL NOT NULL,
  teams_in_red_zone INTEGER NOT NULL,
  unhedged_deficit_hours REAL NOT NULL,
  total_hiring_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshot_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  fte_count REAL NOT NULL,
  weekly_hours REAL NOT NULL,
  effective_capacity_percentage REAL NOT NULL,
  annual_salary_baseline REAL NOT NULL,
  contracted_hours REAL NOT NULL,
  operational_hours REAL NOT NULL,
  load_percentage REAL NOT NULL,
  is_red_zone INTEGER CHECK(is_red_zone IN (0, 1)) NOT NULL,
  deficit_hours REAL NOT NULL,
  hiring_cost REAL NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS snapshot_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  deploy_hours REAL NOT NULL,
  maintenance_hours REAL NOT NULL,
  criticality_weight REAL NOT NULL,
  is_automated INTEGER CHECK(is_automated IN (0, 1)) NOT NULL,
  has_expertise INTEGER CHECK(has_expertise IN (0, 1)) NOT NULL,
  ownership_model TEXT CHECK(ownership_model IN ('sre_full', 'shared', 'dev_owned')) NOT NULL,
  prr_approved INTEGER CHECK(prr_approved IN (0, 1)) NOT NULL,
  slo_status TEXT CHECK(slo_status IN ('healthy', 'warning', 'exhausted')) NOT NULL,
  is_active INTEGER CHECK(is_active IN (0, 1)) NOT NULL,
  required_hours REAL NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_snapshot_teams_lookup ON snapshot_teams(snapshot_id, team_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_services_lookup ON snapshot_services(snapshot_id, team_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trigger_type TEXT NOT NULL,
  snapshot_id TEXT,
  message TEXT NOT NULL
);
