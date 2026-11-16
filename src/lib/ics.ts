import { addDays } from './date';
import { canProject, computeStats, projectCycles } from './cycle';
import type { DayEvent, DayKey, Settings } from './types';

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

/** Fold a content line to 75 octets, counting the continuation space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
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
    throw new Error('Predictions are not available in this mode.');
  }
  const cycles = projectCycles(stats, settings, 3);
  if (cycles.length === 0) {
    throw new Error('There is not enough data to export predictions yet.');
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cycal//Cycle predictions//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Cycal predictions',
  ];

  for (const cycle of cycles) {
    const periodEnd = addDays(cycle.start, cycle.periodDays.length);
    lines.push(
      ...eventLines(
        `cycal-period-${cycle.start}`,
        cycle.start,
        periodEnd,
        'Period (estimate)',
        'Predicted period. Cycal estimate - not contraception.',
        now,
      ),
    );
    if (cycle.fertile && cycle.pms && cycle.ovulation) {
      lines.push(
        ...eventLines(
          `cycal-fertile-${cycle.start}`,
          cycle.fertile.from,
          addDays(cycle.fertile.to, 1),
          'Fertile window (estimate)',
          `Estimated ovulation around ${cycle.ovulation}. Cycal estimate - not contraception.`,
          now,
        ),
        ...eventLines(
          `cycal-pms-${cycle.start}`,
          cycle.pms.from,
          addDays(cycle.pms.to, 1),
          'PMS window (estimate)',
          'Predicted PMS window. Cycal estimate.',
          now,
        ),
      );
    }
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
