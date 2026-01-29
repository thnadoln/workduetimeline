import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Calendar as CalendarIcon, ArrowRight, Trash2, Maximize2, Minimize2, Target, ZoomIn, ZoomOut } from 'lucide-react';
import { format, addDays, isBefore, differenceInDays } from 'date-fns';
import type { DateItem, TimelineEvent } from './types';
import { generateDates, getInitialDates } from './utils/dateUtils';

const parseISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const LINE_COLUMN_WIDTH = 96; 
const GRID_ROW_HEIGHT = 340; 
const EVENT_HEIGHT = 44;
const EVENT_GAP = 8;
const TIMELINE_START_OFFSET = 180;

type ViewMode = 'line' | 'grid';
type ThemeKey = 'slate' | 'indigo' | 'emerald';

const THEMES = {
  slate: {
    name: 'Neutral Slate', primary: 'bg-slate-800', primaryHover: 'hover:bg-slate-900', containerBg: 'bg-slate-100', cardBg: 'bg-slate-50', headerBg: 'bg-slate-50/80', itemBg: 'bg-slate-200/30', light: 'bg-slate-100', text: 'text-slate-900', mutedText: 'text-slate-400', shadow: 'shadow-slate-200/50', borderLight: 'border-slate-200/60', ring: 'focus:ring-slate-800', focusBorder: 'focus:border-slate-800', barBorder: 'border-l-slate-800'
  },
  indigo: {
    name: 'Soft Indigo', primary: 'bg-indigo-600', primaryHover: 'hover:bg-indigo-700', containerBg: 'bg-indigo-50/80', cardBg: 'bg-indigo-50', headerBg: 'bg-indigo-50/80', itemBg: 'bg-indigo-100/40', light: 'bg-indigo-100/60', text: 'text-indigo-900', mutedText: 'text-indigo-400', shadow: 'shadow-indigo-200/40', borderLight: 'border-indigo-200/40', ring: 'focus:ring-indigo-600', focusBorder: 'focus:border-indigo-600', barBorder: 'border-l-indigo-600'
  },
  emerald: {
    name: 'Fresh Emerald', primary: 'bg-emerald-600', primaryHover: 'hover:bg-emerald-700', containerBg: 'bg-emerald-50/80', cardBg: 'bg-emerald-50/60', headerBg: 'bg-emerald-50/80', itemBg: 'bg-emerald-100/30', light: 'bg-emerald-100/50', text: 'text-emerald-900', mutedText: 'text-emerald-400', shadow: 'shadow-emerald-200/40', borderLight: 'border-emerald-200/40', ring: 'focus:ring-emerald-600', focusBorder: 'focus:border-emerald-600', barBorder: 'border-l-emerald-600'
  }
} as const;

type Theme = typeof THEMES[keyof typeof THEMES];

const App: React.FC = () => {
  const [dates, setDates] = useState<DateItem[]>(getInitialDates());
  const [viewMode, setViewMode] = useState<ViewMode>('line');
  const [containerWidth, setContainerWidth] = useState(1200);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    try {
      const saved = localStorage.getItem('timeline_theme_v12');
      return (saved as ThemeKey) || 'slate';
    } catch { return 'slate'; }
  });
  
  const [events, setEvents] = useState<TimelineEvent[]>(() => {
    try {
      const saved = localStorage.getItem('timeline_events_v12');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<DateItem | null>(null);
  const [endDateStr, setEndDateStr] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [lastCreatedEventId, setLastCreatedEventId] = useState<string | null>(null);

  const [resizingEventId, setResizingEventId] = useState<string | null>(null);
  const initialX = useRef<number>(0);
  const initialEndDate = useRef<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialScrollDone = useRef(false);

  const t = THEMES[themeKey];

  const gridColumnWidth = useMemo(() => (containerWidth - 80) / 14, [containerWidth]);

  useEffect(() => {
    const handleResize = () => {
      if (mainContainerRef.current) setContainerWidth(mainContainerRef.current.offsetWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('timeline_events_v12', JSON.stringify(events)); } catch (e) { console.error("Storage failed", e); }
  }, [events]);

  useEffect(() => {
    try { localStorage.setItem('timeline_theme_v12', themeKey); } catch (e) { console.error("Storage failed", e); }
  }, [themeKey]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingEventId) return;
      const currentWidth = viewMode === 'line' ? LINE_COLUMN_WIDTH : gridColumnWidth;
      const deltaX = e.clientX - initialX.current;
      const daysDelta = Math.round(deltaX / currentWidth);
      const currentEvent = events.find(ev => ev.id === resizingEventId);
      if (!currentEvent) return;
      const newEndDate = format(addDays(parseISODate(initialEndDate.current), daysDelta), 'yyyy-MM-dd');
      if (isBefore(parseISODate(newEndDate), parseISODate(currentEvent.startDate))) return;
      setEvents(prev => prev.map(ev => ev.id === resizingEventId ? { ...ev, endDate: newEndDate } : ev));
    };
    const handleMouseUp = () => setResizingEventId(null);
    if (resizingEventId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingEventId, events, gridColumnWidth, viewMode]);

  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const todayEl = document.getElementById('today-indicator-container');
    if (todayEl) {
      if (viewMode === 'line') {
        const centerOffset = (container.clientWidth / 2) - (LINE_COLUMN_WIDTH / 2);
        container.scrollTo({ left: todayEl.offsetLeft - centerOffset, behavior: isInitialScrollDone.current ? 'smooth' : 'auto' });
      } else {
        const centerOffset = (container.clientHeight / 2) - (GRID_ROW_HEIGHT / 2);
        container.scrollTo({ top: todayEl.offsetTop - centerOffset, behavior: isInitialScrollDone.current ? 'smooth' : 'auto' });
      }
      isInitialScrollDone.current = true;
    }
  }, [viewMode]);

  useEffect(() => { 
    const timer = setTimeout(scrollToToday, 200); 
    return () => clearTimeout(timer);
  }, [dates, viewMode, scrollToToday]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth, scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (viewMode === 'line') {
      if (scrollLeft + clientWidth > scrollWidth - 1200) {
        const lastDate = dates[dates.length - 1].date;
        setDates(prev => [...prev, ...generateDates(addDays(lastDate, 1), 28)]);
      }
      if (scrollLeft < 1200) {
        const firstDate = dates[0].date;
        setDates(prev => [...generateDates(addDays(firstDate, -29), 28), ...prev]);
        scrollContainerRef.current.scrollLeft += 28 * LINE_COLUMN_WIDTH;
      }
    } else {
      if (scrollTop + clientHeight > scrollHeight - 1200) {
        const lastDate = dates[dates.length - 1].date;
        setDates(prev => [...prev, ...generateDates(addDays(lastDate, 1), 56)]); 
      }
      if (scrollTop < 400) {
        const firstDate = dates[0].date;
        setDates(prev => [...generateDates(addDays(firstDate, -57), 56), ...prev]);
        scrollContainerRef.current.scrollTop += (56 / 14) * GRID_ROW_HEIGHT;
      }
    }
  }, [dates, viewMode]);

  const handleDateDoubleClick = (dateItem: DateItem) => {
    setEditingEventId(null);
    setSelectedDate(dateItem);
    setEndDateStr(dateItem.id);
    setNewEventTitle('');
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: TimelineEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEventId(event.id);
    setSelectedDate({
      date: parseISODate(event.startDate), id: event.startDate,
      isToday: false, isWeekend: false, dayName: '', monthName: '', dayNumber: 0
    });
    setEndDateStr(event.endDate);
    setNewEventTitle(event.title);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = () => {
    if (editingEventId) {
      setEvents(prev => prev.filter(e => e.id !== editingEventId));
      setIsModalOpen(false);
      setEditingEventId(null);
    }
  };

  const handleSaveEvent = () => {
    if (!selectedDate || !newEventTitle.trim()) return;
    const start = parseISODate(selectedDate.id);
    let end = parseISODate(endDateStr);
    if (isBefore(end, start)) end = start;

    const data = {
      title: newEventTitle, description: '',
      startDate: selectedDate.id,
      endDate: format(end, 'yyyy-MM-dd'),
    };

    if (editingEventId) {
      setEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, ...data } : e));
    } else {
      const newId = Math.random().toString(36).substr(2, 9);
      setEvents(prev => [...prev, { id: newId, ...data }]);
      setLastCreatedEventId(newId);
      setTimeout(() => setLastCreatedEventId(null), 1000);
    }
    setIsModalOpen(false);
  };

  const eventSlots = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate));
    const slots: Record<string, number> = {};
    const occupied: { start: string, end: string }[][] = [];
    sorted.forEach(event => {
      let slot = 0;
      while (true) {
        if (!occupied[slot]) { occupied[slot] = []; break; }
        const hasCollision = occupied[slot].some(occ => !(event.endDate < occ.start || event.startDate > occ.end));
        if (!hasCollision) break;
        slot++;
      }
      occupied[slot].push({ start: event.startDate, end: event.endDate });
      slots[event.id] = slot;
    });
    return slots;
  }, [events]);

  const dateRows = useMemo(() => {
    const rows: DateItem[][] = [];
    for (let i = 0; i < dates.length; i += 14) {
      const chunk = dates.slice(i, i + 14);
      if (chunk.length > 0) rows.push(chunk);
    }
    return rows;
  }, [dates]);

  return (
    <div className={`w-full bg-slate-100 overflow-x-hidden overflow-y-auto h-screen font-sans select-none scroll-smooth ${resizingEventId ? 'cursor-col-resize' : ''}`}>
      <section className="h-screen w-full flex flex-col items-center justify-center p-4 sm:p-12">
        <div ref={mainContainerRef} className={`w-full max-w-[1440px] h-full max-h-[85vh] ${t.containerBg} rounded-[2.5rem] sm:rounded-[4rem] shadow-2xl border ${t.borderLight} flex flex-col overflow-hidden relative transition-all duration-700`}>
          
          <header className={`h-16 sm:h-20 px-6 sm:px-10 ${t.headerBg} backdrop-blur-md border-b ${t.borderLight} flex items-center justify-between shrink-0 z-40 transition-colors duration-700`}>
            <div className="flex items-center gap-4">
              <div className={`p-2 sm:p-2.5 ${t.primary} rounded-xl sm:rounded-2xl shadow-lg`}>
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className={`text-lg sm:text-2xl font-black ${t.text} tracking-tight leading-none`}>Timeline</h1>
                <p className={`text-[8px] sm:text-[10px] font-bold ${t.mutedText} uppercase tracking-widest mt-1 sm:mt-1.5`}>Production Ready</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="flex bg-black/5 p-1 rounded-xl sm:rounded-2xl border border-black/5">
                <button onClick={() => setViewMode('line')} className={`p-1.5 sm:p-2 px-3 sm:px-5 rounded-lg sm:rounded-xl transition-all flex items-center gap-2 text-[10px] sm:text-xs font-black tracking-widest ${viewMode === 'line' ? `bg-white shadow-sm ${t.text}` : 'text-gray-400 hover:text-gray-600'}`}>
                  <Maximize2 size={14} /> <span className="hidden sm:inline">LINE</span>
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 px-3 sm:px-5 rounded-lg sm:rounded-xl transition-all flex items-center gap-2 text-[10px] sm:text-xs font-black tracking-widest ${viewMode === 'grid' ? `bg-white shadow-sm ${t.text}` : 'text-gray-400 hover:text-gray-600'}`}>
                  <Minimize2 size={14} /> <span className="hidden sm:inline">GRID</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 relative overflow-hidden bg-transparent">
            <div ref={scrollContainerRef} onScroll={handleScroll} className={`h-full hide-scrollbar overflow-auto transition-colors duration-700`}>
              {viewMode === 'line' ? (
                <div className="relative flex h-full min-w-max">
                  {dates.map((dateItem) => (
                    <div 
                      key={dateItem.id} id={dateItem.isToday ? 'today-indicator-container' : undefined} onDoubleClick={() => handleDateDoubleClick(dateItem)}
                      className={`flex-none w-24 flex flex-col items-center pt-24 border-r ${t.borderLight} transition-colors duration-700 relative ${dateItem.isWeekend ? t.itemBg : 'bg-transparent'} hover:bg-black/5 cursor-crosshair z-0`}
                    >
                      <span className={`text-[10px] uppercase tracking-widest font-black mb-2 ${dateItem.isToday ? t.text : 'text-gray-300'}`}>{dateItem.dayName}</span>
                      <div className={`flex items-center justify-center rounded-2xl transition-all duration-700 text-2xl font-black ${dateItem.isToday ? `${t.primary} text-white w-14 h-14 shadow-xl` : `w-12 h-12 ${t.text} opacity-70`}`}>
                        {dateItem.dayNumber}
                      </div>
                      <div className={`absolute top-[190px] inset-x-0 h-[1px] ${t.borderLight} -z-10`}></div>
                    </div>
                  ))}
                  
                  <div className="absolute inset-0 pointer-events-none z-10" style={{ top: `${TIMELINE_START_OFFSET + 20}px` }}>
                    {events.map(event => {
                      const startIndex = dates.findIndex(d => d.id === event.startDate);
                      const endIndex = dates.findIndex(d => d.id === event.endDate);
                      if (startIndex === -1 || endIndex === -1) return null;

                      const slot = eventSlots[event.id] ?? 0;
                      const left = (startIndex * LINE_COLUMN_WIDTH) + (LINE_COLUMN_WIDTH / 2);
                      const visualWidth = (endIndex - startIndex) * LINE_COLUMN_WIDTH;

                      return (
                        <div key={event.id} className={`absolute pointer-events-none ${lastCreatedEventId === event.id ? 'animate-create-event' : ''}`}
                          style={{ left: `${left}px`, top: `${slot * (EVENT_HEIGHT + EVENT_GAP)}px`, height: `${EVENT_HEIGHT}px`, width: `${Math.max(visualWidth, 20)}px` }}
                        >
                          <EventBar event={event} onEdit={handleEditEvent} onResize={(ev, e) => { e.stopPropagation(); setResizingEventId(ev.id); initialX.current = e.clientX; initialEndDate.current = ev.endDate; }} themeStyles={t} isResizing={resizingEventId === event.id} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col w-full items-center py-16 min-h-full px-6 sm:px-10">
                  {dateRows.map((row, rowIdx) => {
                    const rowStartID = row[0]?.id;
                    const rowEndID = row[row.length - 1]?.id;
                    return (
                      <div key={rowIdx} className={`w-full max-w-[1300px] flex-none relative ${t.cardBg} border ${t.borderLight} rounded-[3rem] shadow-xl mb-20 overflow-hidden transition-all duration-700`} style={{ height: `${GRID_ROW_HEIGHT}px` }}>
                        <div className={`flex h-full border-b ${t.borderLight}`}>
                          {row.map((dateItem) => (
                            <div key={dateItem.id} id={dateItem.isToday ? 'today-indicator-container' : undefined} onDoubleClick={() => handleDateDoubleClick(dateItem)} 
                              style={{ width: `${100/14}%` }}
                              className={`flex-none flex flex-col items-center pt-10 border-r ${t.borderLight} last:border-r-0 transition-colors relative ${dateItem.isWeekend ? t.itemBg : 'bg-transparent'} hover:bg-black/5 cursor-crosshair`}
                            >
                              <span className={`text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-black mb-1 ${dateItem.isToday ? t.text : 'text-gray-300'}`}>{dateItem.dayName}</span>
                              <div className={`flex items-center justify-center rounded-2xl transition-all duration-700 text-sm sm:text-xl font-black ${dateItem.isToday ? `${t.primary} text-white w-8 h-8 sm:w-12 sm:h-12 shadow-lg` : `w-8 h-8 sm:w-10 sm:h-10 ${t.text} opacity-60`}`}>{dateItem.dayNumber}</div>
                            </div>
                          ))}
                        </div>
                        <div className="absolute inset-0 pointer-events-none z-10" style={{ top: `125px` }}>
                          {events.map(event => {
                            if (event.endDate < rowStartID || event.startDate > rowEndID) return null;
                            const startIndex = row.findIndex(d => d.id === event.startDate);
                            const endIndex = row.findIndex(d => d.id === event.endDate);
                            const slot = eventSlots[event.id] ?? 0;
                            const rowWidth = gridColumnWidth * 14;
                            const startX = startIndex === -1 ? 0 : (startIndex * gridColumnWidth) + (gridColumnWidth / 2);
                            const endX = endIndex === -1 ? rowWidth : (endIndex * gridColumnWidth) + (gridColumnWidth / 2);
                            
                            return (
                              <div key={`${event.id}-${rowIdx}`} className={`absolute pointer-events-none ${lastCreatedEventId === event.id ? 'animate-create-event' : ''}`}
                                style={{ left: `${startX}px`, top: `${slot * (EVENT_HEIGHT + EVENT_GAP)}px`, height: `${EVENT_HEIGHT}px`, width: `${Math.max(endX - startX, 20)}px` }}
                              >
                                <EventBar event={event} isSplitStart={startIndex === -1} isSplitEnd={endIndex === -1} onEdit={handleEditEvent} onResize={(ev, e) => { e.stopPropagation(); setResizingEventId(ev.id); initialX.current = e.clientX; initialEndDate.current = ev.endDate; }} themeStyles={t} isResizing={resizingEventId === event.id} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-50">
              <button onClick={scrollToToday} className={`p-4 shadow-2xl rounded-2xl bg-white/80 hover:bg-white transition-all hover:scale-110 active:scale-95 border ${t.borderLight} ${t.text}`}><Target size={24} /></button>
              <button onClick={() => setViewMode(viewMode === 'line' ? 'grid' : 'line')} className={`p-4 shadow-2xl rounded-2xl bg-white/80 hover:bg-white transition-all hover:scale-110 active:scale-95 border ${t.borderLight} ${t.text}`}>{viewMode === 'line' ? <ZoomOut size={24} /> : <ZoomIn size={24} />}</button>
            </div>
          </main>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`${t.cardBg} rounded-[2.5rem] shadow-2xl w-full max-w-[420px] overflow-hidden animate-in zoom-in duration-300 border ${t.borderLight}`}>
            <div className="p-8 pb-2 flex justify-between items-start">
              <h3 className={`text-3xl font-black ${t.text} tracking-tight`}>{editingEventId ? 'Edit Event' : 'New Event'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 pt-4 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Event Title (15 chars limit)</label>
                <input type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value.substring(0, 15))} placeholder="Title..." autoFocus className={`w-full px-6 py-4 bg-black/5 border-2 border-transparent rounded-2xl ${t.focusBorder} transition-all font-bold text-lg focus:outline-none`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Start</label>
                  <div className="px-5 py-4 bg-black/5 rounded-xl font-bold text-sm flex items-center gap-2"><CalendarIcon size={16} /> {selectedDate ? format(selectedDate.date, 'MMM do') : ''}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">End</label>
                  <input type="date" value={endDateStr} min={selectedDate?.id} onChange={(e) => setEndDateStr(e.target.value)} className={`w-full px-4 py-4 bg-black/5 rounded-xl font-bold text-sm focus:outline-none`} />
                </div>
              </div>
            </div>
            <div className="p-8 flex items-center justify-between gap-4 bg-black/5">
              <div className="flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="py-4 px-4 font-bold text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                {editingEventId && (
                  <button onClick={handleDeleteEvent} className="p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors" title="Delete Event">
                    <Trash2 size={24} />
                  </button>
                )}
              </div>
              <button onClick={handleSaveEvent} className={`flex-1 py-4 ${t.primary} text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all`}>Save <ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface EventBarProps {
  event: TimelineEvent;
  isSplitStart?: boolean;
  isSplitEnd?: boolean;
  onEdit: (event: TimelineEvent, e: React.MouseEvent) => void;
  onResize: (event: TimelineEvent, e: React.MouseEvent) => void;
  themeStyles: Theme;
  isResizing: boolean;
}

const EventBar: React.FC<EventBarProps> = ({ event, isSplitStart, isSplitEnd, onEdit, onResize, themeStyles: t, isResizing }) => {
  const truncatedTitle = useMemo(() => {
    return event.title.length > 15 ? event.title.substring(0, 15) : event.title;
  }, [event.title]);

  return (
    <div className={`relative h-full flex items-center group transition-transform ${isResizing ? 'scale-y-[1.1]' : ''}`}>
      {/* Main Bubble */}
      <div 
        onClick={(e) => onEdit(event, e)}
        className={`absolute left-0 z-10 h-full flex items-center pointer-events-auto cursor-pointer ${t.containerBg} border border-black/10 px-4 py-1 shadow-md border-l-4 ${t.barBorder} transition-all 
          ${isSplitStart ? 'rounded-l-none' : 'rounded-l-2xl'} 
          ${isSplitEnd ? 'rounded-r-none' : 'rounded-r-2xl'}
          group-hover:shadow-lg group-hover:scale-[1.02]
        `}
        style={{ width: 'max-content', minWidth: 'max-content' }}
      >
        <div className="flex items-center gap-3 whitespace-nowrap overflow-hidden pr-2">
          <span className={`text-[12px] font-black ${t.text} uppercase tracking-tight`}>{truncatedTitle}</span>
        </div>
        
        {/* Drag out handle */}
        {!isSplitEnd && (
          <div 
            onMouseDown={(e) => onResize(event, e)} 
            className="absolute right-0 inset-y-0 w-6 cursor-col-resize group/handle flex items-center justify-end z-20 pointer-events-auto pr-1"
            title="Drag to extend"
          >
            <div className={`w-1 h-1/2 rounded-full ${t.primary} opacity-20 group-hover/handle:opacity-100 transition-all`} />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;