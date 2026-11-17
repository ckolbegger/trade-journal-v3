// The Journal's words for a moment (W27, A239), shared by the session cards and the list kept as the fallback. Pure formatting: the instants come
// from the view (ADR 0001).
import { localTime, shortDate } from '../../format.ts';

// "Thu Nov 12, 1:40 pm": an instant in the Workspace zone.
export function dateAndTime(instant: string, timeZone: string): string {
  const [date = '', time = '00:00'] = localTime(instant, timeZone).split(' ');
  const [hour = 0, minute = '00'] = time.split(':');
  return `${shortDate(date)}, ${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? 'am' : 'pm'}`;
}

// "Daily Review · Thu Oct 15, 4:00 pm", with " · written Fri Oct 16" when the entry was written on a later Workspace-zone date.
export function entryLine(source: string, momentTime: string, authoredTime: string, timeZone: string): string {
  const momentDate = localTime(momentTime, timeZone).slice(0, 10);
  const authoredDate = localTime(authoredTime, timeZone).slice(0, 10);
  return `${source} · ${dateAndTime(momentTime, timeZone)}${authoredDate > momentDate ? ` · written ${shortDate(authoredDate)}` : ''}`;
}
