const takaFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { ...DATE_OPTIONS, hour: '2-digit', minute: '2-digit' };
const MS_PER_DAY = 86_400_000;

export function formatTaka(amount: number): string {
  return `Tk ${takaFormatter.format(amount)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatLabel(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', DATE_OPTIONS);
}

export function formatDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-GB', DATE_TIME_OPTIONS);
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
