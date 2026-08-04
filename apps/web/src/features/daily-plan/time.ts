const MINUTES_PER_HOUR = 60;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getTodayLocalDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function combineLocalDateAndTime(localDate: string, localTime: string): number {
  const timestamp = new Date(`${localDate}T${localTime}:00`).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error('无效的日期或时间');
  }
  return timestamp;
}

export function parseLocalDateTime(localDateTime: string): number {
  const timestamp = new Date(localDateTime).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error('无效的日期时间');
  }
  return timestamp;
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${minutes} 分钟`;
  }
  if (minutes === 0) {
    return `${hours} 小时`;
  }
  return `${hours} 小时 ${minutes} 分钟`;
}

export function formatLocalTimeRange(startAtMs: number, endAtMs: number): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatter.format(startAtMs)} - ${formatter.format(endAtMs)}`;
}
