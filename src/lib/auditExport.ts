export interface AuditLogRow {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

export function exportAuditLogsToCsv(rows: AuditLogRow[], filename = 'audit-logs.csv'): void {
  const headers = ['ID', 'Action', 'Actor', 'Timestamp (ISO)', 'Details'];
  const lines = rows.map(r => [
    r.id,
    r.action,
    r.actor,
    new Date(r.timestamp).toISOString(),
    `"${(r.details || '').replace(/"/g, '""')}"`
  ].join(','));

  const csvContent = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
}
