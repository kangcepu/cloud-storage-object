export function formatBytes(value: number | string | null | undefined): string {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toLocaleString('id-ID', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Belum ada'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function basename(path: string): string {
  return path.replace(/\/$/, '').split('/').pop() || path
}

export function extension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || ''
}

export function joinObjectPath(prefix: string, name: string, folder = false): string {
  const normalized = `${prefix}${name}`.replace(/\/{2,}/g, '/')
  return folder ? `${normalized.replace(/\/$/, '')}/` : normalized.replace(/\/$/, '')
}
