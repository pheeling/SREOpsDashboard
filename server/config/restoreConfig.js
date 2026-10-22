/**
 * Governed via Git: changing this requires a commit and PR.
 * To disable automated self-healing, set AUTO_RESTORE_ENABLED = false.
 */
export const RESTORE_CONFIG = Object.freeze({
  AUTO_RESTORE_ENABLED: true,
  RESTORE_CRON_SCHEDULE: '0 */6 * * *',
  TARGET_SNAPSHOT_ID: '9af60ba3-9931-4499-96dc-e40f00f8fb72',
  AUDIT_LOG_NOTE: 'Automated 6-hour Public Demo Reset',
});
