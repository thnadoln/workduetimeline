
export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO string (yyyy-MM-dd)
  endDate: string;   // ISO string (yyyy-MM-dd)
  color?: string;
}

export interface DateItem {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  dayName: string;
  monthName: string;
  dayNumber: number;
  id: string;
}
