
import { 
  format, 
  isSameDay, 
  isWeekend, 
  addDays
} from 'date-fns';
import { DateItem } from '../types';

export const generateDates = (startDate: Date, days: number): DateItem[] => {
  const dates: DateItem[] = [];
  // Fix: Replaced startOfDay with manual local date creation
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
  // Generate ~182 days before and after today, aligned to weeks (14-day chunks)
  const today = new Date();
  // Fix: Replaced subDays with addDays and negative value, and startOfWeek with manual calculation
  const midPoint = addDays(today, -182);
  const start = addDays(midPoint, -midPoint.getDay()); 
  return generateDates(start, 364); // 26 weeks * 14 days = 364
};
