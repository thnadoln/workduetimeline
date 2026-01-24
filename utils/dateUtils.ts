
import { 
  format, 
  isSameDay, 
  isWeekend, 
  addDays
} from 'date-fns';
import type { DateItem } from '../types';

export const generateDates = (startDate: Date, days: number): DateItem[] => {
  const dates: DateItem[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = 0; i < days; i++) {
    const current = addDays(startDate, i);
    dates.push({
      date: current,
      isToday: isSameDay(current, today),
      isWeekend: isWeekend(current),
      dayName: format(current, 'EEE'),
      monthName: format(current, 'MMMM'),
      dayNumber: current.getDate(),
      id: format(current, 'yyyy-MM-dd'),
    });
  }
  return dates;
};

export const getInitialDates = () => {
  const today = new Date();
  const midPoint = addDays(today, -182);
  const start = addDays(midPoint, -midPoint.getDay()); 
  return generateDates(start, 364);
};
