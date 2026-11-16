import { addDays } from './date';
import { canProject, computeStats, projectCycles } from './cycle';
import { COPY } from './strings';
import type { DayEvent, DayKey, Settings } from './types';

const encoder = new TextEncoder();

function compact(day: DayKey): string {
  return day.replaceAll('-', '');
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n');
}

/**
 * Fold one content line to 75 octets, counting the continuation space.
 * Lithuanian is multibyte, so measuring characters would overflow the limit.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let first = true;

  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = first ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(first ? current : ` ${current}`);
      current = char;
      bytes = size;
      first = false;
    } else {
      current += char;
      bytes += size;
    }
  }
  if (current) parts.push(first ? current : ` ${current}`);
  return parts.join('\r\n');
}

function eventLines(
  uid: string,
  start: DayKey,
  endExclusive: DayKey,
  summary: string,
  description: string,
  now: Date,
): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@cycal.local`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compact(start)}`,
    `DTEND;VALUE=DATE:${compact(endExclusive)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

/**
 * Next three predicted cycles as all-day calendar events. Deliberately no
 * alarms: the user's calendar app owns reminders.
 */
export function buildPredictionICS(
  events: DayEvent[],
  settings: Settings,
  today: DayKey,
  now: Date = new Date(),
): string {
  const stats = computeStats(events, settings, today);
  if (!canProject(stats)) {
    throw new Error(COPY.errors.icsUnavailable);
  }
  const cycles = projectCycles(stats, settings, 3);
  if (cycles.length === 0) {
    throw new Error(COPY.errors.icsNoData);
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${COPY.ics.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${COPY.ics.calendarName}`,
  ];

  for (const cycle of cycles) {
    const periodEnd = addDays(cycle.start, cycle.periodDays.length);
    lines.push(
      ...eventLines(
        `cycal-period-${cycle.start}`,
        cycle.start,
        periodEnd,
        COPY.ics.period,
        COPY.ics.periodDescription,
        now,
      ),
    );
    if (cycle.fertile && cycle.pms && cycle.ovulation) {
      lines.push(
        ...eventLines(
          `cycal-fertile-${cycle.start}`,
          cycle.fertile.from,
          addDays(cycle.fertile.to, 1),
          COPY.ics.fertile,
          COPY.ics.fertileDescription(cycle.ovulation),
          now,
        ),
        ...eventLines(
          `cycal-pms-${cycle.start}`,
          cycle.pms.from,
          addDays(cycle.pms.to, 1),
          COPY.ics.pms,
          COPY.ics.pmsDescription,
          now,
        ),
      );
    }
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
