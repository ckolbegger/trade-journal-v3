import type { TableRow, TableSource } from './types.ts';

// Every one-off closure and every early close in the coverage window. Regular holidays come from
// rules.ts, not from here. T4.2 compares this table with NYSE's published calendars.

const ICE_2023: TableSource = {
  name: 'NYSE Group Announces 2024, 2025 and 2026 Holiday and Early Closings Calendar (ICE press release, 2023-11-10)',
  url: 'https://ir.theice.com/press/news-details/2023/NYSE-Group-Announces-2024-2025-and-2026-Holiday-and-Early-Closings-Calendar/default.aspx',
};
const ICE_2025: TableSource = {
  name: 'NYSE Group Announces 2026, 2027 and 2028 Holiday and Early Closings Calendar (ICE press release, 2025-12-23)',
  url: 'https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx',
};
const CARTER: TableSource = {
  name: 'The New York Stock Exchange Will Close Markets on January 9 to Honor the Passing of Former President Jimmy Carter on National Day of Mourning (ICE press release, 2024-12-30)',
  url: 'https://ir.theice.com/press/news-details/2024/The-New-York-Stock-Exchange-Will-Close-Markets-on-January-9-to-Honor-the-Passing-of-Former-President-Jimmy-Carter-on-National-Day-of-Mourning/default.aspx',
};

export const NYSE_TABLE: readonly TableRow[] = [
  { date: '2025-01-09', kind: 'Closure', name: 'National Day of Mourning for President Jimmy Carter', source: CARTER },
  { date: '2024-07-03', kind: 'EarlyClose', name: 'Day before Independence Day', source: ICE_2023 },
  { date: '2024-11-29', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: ICE_2023 },
  { date: '2024-12-24', kind: 'EarlyClose', name: 'Christmas Eve', source: ICE_2023 },
  { date: '2025-07-03', kind: 'EarlyClose', name: 'Day before Independence Day', source: ICE_2023 },
  { date: '2025-11-28', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: ICE_2023 },
  { date: '2025-12-24', kind: 'EarlyClose', name: 'Christmas Eve', source: ICE_2023 },
  { date: '2026-11-27', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: ICE_2025 },
  { date: '2026-12-24', kind: 'EarlyClose', name: 'Christmas Eve', source: ICE_2025 },
  { date: '2027-11-26', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: ICE_2025 },
  { date: '2028-07-03', kind: 'EarlyClose', name: 'Day before Independence Day', source: ICE_2025 },
  { date: '2028-11-24', kind: 'EarlyClose', name: 'Day after Thanksgiving', source: ICE_2025 },
];
