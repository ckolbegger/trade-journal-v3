import type { TableRow, TableSource } from './types.ts';

// Every one-off closure and every early close in the coverage window. Regular holidays come from
// rules.ts, not from here. T4.2 compares this table with NYSE's published calendars.

const HOURS: TableSource = {
  name: 'NYSE Holidays & Trading Hours',
  url: 'https://www.nyse.com/markets/hours-calendars',
};
const CLOSINGS: TableSource = {
  name: 'NYSE historical market closings',
  url: 'https://www.nyse.com/markets/hours-calendars',
};

export const NYSE_TABLE: readonly TableRow[] = [
  { date: '2025-01-09', kind: 'Closure', name: 'National Day of Mourning for President Jimmy Carter', source: CLOSINGS },
  { date: '2024-07-03', kind: 'EarlyClose', name: 'Day before Independence Day', source: HOURS },
  { date: '2024-11-29', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: HOURS },
  { date: '2024-12-24', kind: 'EarlyClose', name: 'Christmas Eve', source: HOURS },
  { date: '2025-07-03', kind: 'EarlyClose', name: 'Day before Independence Day', source: HOURS },
  { date: '2025-11-28', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: HOURS },
  { date: '2025-12-24', kind: 'EarlyClose', name: 'Christmas Eve', source: HOURS },
  { date: '2026-11-27', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: HOURS },
  { date: '2026-12-24', kind: 'EarlyClose', name: 'Christmas Eve', source: HOURS },
  { date: '2027-11-26', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: HOURS },
  { date: '2028-07-03', kind: 'EarlyClose', name: 'Day before Independence Day', source: HOURS },
  { date: '2028-11-24', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: HOURS },
];
