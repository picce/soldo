/**
 * Version of the backup file format (docs/specs/backup-manuale.md). A change that older
 * files cannot satisfy raises it, and readBackup (import.ts) learns to upgrade the older
 * files before checking them. Here and not in format.ts, so exporting does not load the
 * validation library.
 */
export const BACKUP_FORMAT = 1
