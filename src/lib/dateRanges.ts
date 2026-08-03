export type DateRangeOption = 'week' | 'month' | 'quarter';

export const dateRangeLabels: Record<DateRangeOption, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
};

export const dateRangeTrendLabels: Record<DateRangeOption, string> = {
  week: 'vs last week',
  month: 'vs last month',
  quarter: 'vs last quarter',
};

export interface DateRangeBounds {
  start: string;
  prevStart: string;
  prevEnd: string;
}

// Returns the current period's start date and the prior period's [start, end)
// bounds, all as YYYY-MM-DD, for comparing "this X" against "last X".
export function getDateRangeBounds(range: DateRangeOption): DateRangeBounds {
  const now = new Date();
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (range === 'week') {
    const dayOfWeek = now.getDay(); // 0 = Sunday
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    prevEnd = new Date(start);
    prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
  } else if (range === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), quarterStartMonth, 1);
    prevEnd = new Date(start);
    prevStart = new Date(now.getFullYear(), quarterStartMonth - 3, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    prevEnd = new Date(start);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  const toISODate = (d: Date) => d.toISOString().split('T')[0];

  return {
    start: toISODate(start),
    prevStart: toISODate(prevStart),
    prevEnd: toISODate(prevEnd),
  };
}
