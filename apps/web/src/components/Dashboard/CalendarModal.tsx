import { useState, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Users, Edit, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAppointments, deleteAppointment } from "@/lib/api";
import type { Appointment } from "@/types";

interface Props {
  initialDate?: Date;
  onClose: () => void;
  onSlotClick: (date: Date, timeStr: string) => void;
  onEditAppt?: (appt: Appointment) => void;
}

export default function CalendarModal({ initialDate, onClose, onSlotClick, onEditAppt }: Props) {
  const qc = useQueryClient();
  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // Fetch all appointments
  const { data: allAppointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => listAppointments(),
    staleTime: 5000,
  });

  const appointmentsByDateStr = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    allAppointments.forEach(appt => {
      const d = new Date(appt.scheduled_time);
      const dateStr = d.toLocaleDateString("en-CA"); // YYYY-MM-DD local
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(appt);
    });
    return map;
  }, [allAppointments]);

  // Navigate functions
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // --- WEEKLY VIEW HELPER ---
  const getWeekDays = () => {
    const current = new Date(currentDate);
    const day = current.getDay(); // 0 is Sunday
    // Start week on Monday
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(current.setDate(diff));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // --- MONTHLY VIEW HELPER ---
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Day of week of 1st day (0-6)
    let startDay = firstDayOfMonth.getDay(); 
    // Adjust for Monday start
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    const days = [];
    // Previous month padding
    for (let i = 0; i < startDay; i++) {
      const d = new Date(year, month, 1 - (startDay - i));
      days.push(d);
    }
    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push(d);
    }
    // Next month padding
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(d);
    }
    return days;
  };

  const hours = Array.from({ length: 24 }, (_, i) => i); // 12 AM to 11 PM

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in p-4 sm:p-6 lg:p-8">
      <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              <CalendarIcon size={22} className="text-teal-600" />
              Calendar
            </h2>
            
            <div className="h-6 w-px bg-neutral-300" />
            
            {/* View toggles */}
            <div className="flex bg-neutral-200/60 p-1 rounded-xl">
              <button
                onClick={() => setView("week")}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                  view === "week" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setView("month")}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                  view === "month" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl shadow-sm p-1">
              <button onClick={handlePrev} className="p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 rounded-lg transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold text-neutral-700 min-w-[140px] text-center">
                {view === "week" ? (
                  `${getWeekDays()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${getWeekDays()[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                ) : (
                  currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                )}
              </span>
              <button onClick={handleNext} className="p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 rounded-lg transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
            
            <button onClick={handleToday} className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors">
              Today
            </button>
            
            <button onClick={onClose} className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 rounded-full transition-colors ml-2">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white p-6 relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
              <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            </div>
          )}

          {view === "week" ? (
            <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-4 h-full min-w-[800px]">
              <div className="col-start-1" />
              {/* Day Headers */}
              {getWeekDays().map((day, i) => {
                const isToday = new Date().toDateString() === day.toDateString();
                return (
                  <div key={i} className={`text-center pb-4 border-b-2 ${isToday ? 'border-teal-500' : 'border-neutral-100'}`}>
                    <div className={`text-sm font-bold ${isToday ? 'text-teal-600' : 'text-neutral-900'}`}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-2xl font-light mt-1 ${isToday ? 'text-teal-600' : 'text-neutral-500'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                );
              })}

              {/* Time Slots */}
              {hours.map((hour) => (
                <div key={hour} className="contents group/row">
                  <div className="col-start-1 text-right pr-4 py-2 text-xs font-medium text-neutral-400 group-hover/row:text-neutral-600 transition-colors">
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                  {getWeekDays().map((day, i) => {
                    const dateStr = day.toLocaleDateString("en-CA");
                    const dayAppts = appointmentsByDateStr[dateStr] || [];
                    const hourAppts = dayAppts.filter(a => {
                      const d = new Date(a.scheduled_time);
                      return d.getHours() === hour;
                    });
                    
                    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

                    return (
                      <div 
                        key={i} 
                        onClick={() => onSlotClick(day, timeStr)}
                        className="relative min-h-[80px] border-b border-r border-neutral-100 hover:bg-teal-50/30 transition-colors cursor-pointer p-1.5 group/cell"
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-opacity">
                          <span className="text-[10px] font-bold text-teal-600 bg-teal-100/80 px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm">
                            <Clock size={10} /> + New
                          </span>
                        </div>
                        <div className="flex flex-row flex-wrap gap-1 relative z-10">
                          {hourAppts.map(appt => {
                            const dAppt = new Date(appt.scheduled_time);
                            const timeString = `${dAppt.getHours() > 12 ? dAppt.getHours() - 12 : dAppt.getHours() === 0 ? 12 : dAppt.getHours()}:${dAppt.getMinutes().toString().padStart(2, '0')} ${dAppt.getHours() >= 12 ? 'PM' : 'AM'}`;
                            return (
                              <div 
                                key={appt.id} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppt(appt);
                                }}
                                className={`flex-1 min-w-[40%] max-w-[90%] p-2 rounded-lg text-xs font-semibold leading-tight border shadow-xs transition-transform hover:scale-[1.02] cursor-pointer
                                  ${appt.status === 'completed' ? 'bg-neutral-100 text-neutral-500 border-neutral-200' : 
                                    appt.status === 'in_consultation' || appt.status === 'arrived' ? 'bg-orange-100 text-orange-800 border-orange-200' : 
                                    'bg-teal-50 text-teal-800 border-teal-200'}
                                `}
                              >
                                <div className="truncate text-[11px] mb-0.5">{timeString}</div>
                                <div className="truncate">{appt.patient_name}</div>
                                <div className="text-[9px] font-bold uppercase opacity-60 mt-0.5">{appt.duration_minutes}m</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            /* Monthly View */
            <div className="h-full flex flex-col min-w-[800px]">
              <div className="grid grid-cols-7 gap-px bg-neutral-200 border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="bg-neutral-50 py-3 text-center text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
                {getMonthDays().map((day, i) => {
                  const dateStr = day.toLocaleDateString("en-CA");
                  const dayAppts = appointmentsByDateStr[dateStr] || [];
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = new Date().toDateString() === day.toDateString();

                  return (
                    <div 
                      key={i}
                      onClick={() => {
                        if (isCurrentMonth) {
                          setCurrentDate(day);
                          setView("week");
                        }
                      }}
                      className={`min-h-[120px] bg-white p-2 relative group transition-colors ${!isCurrentMonth ? 'opacity-40 bg-neutral-50/50 cursor-default' : 'hover:bg-teal-50/20 cursor-pointer'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-teal-600 text-white' : 'text-neutral-700'}`}>
                          {day.getDate()}
                        </span>
                        {dayAppts.length > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md">
                            <Users size={10} />
                            {dayAppts.length}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        {dayAppts.slice(0, 3).map(appt => {
                          const d = new Date(appt.scheduled_time);
                          return (
                            <div 
                              key={appt.id}
                              className="text-[10px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-1 rounded truncate flex items-center justify-between group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-neutral-200 transition-all cursor-default"
                            >
                              <span className="truncate">{appt.patient_name}</span>
                              <span className="text-neutral-400 ml-1 flex-shrink-0">{d.getHours()}:{d.getMinutes().toString().padStart(2, '0')}</span>
                            </div>
                          );
                        })}
                        {dayAppts.length > 3 && (
                          <div className="text-[10px] font-bold text-neutral-400 pl-1 mt-0.5">
                            +{dayAppts.length - 3} more
                          </div>
                        )}
                      </div>

                      {isCurrentMonth && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-teal-50/80 backdrop-blur-[1px]">
                          <span className="text-xs font-bold text-teal-700 bg-white shadow-sm border border-teal-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                            <CalendarIcon size={14} /> View Week
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appointment Details Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedAppt(null)}>
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedAppt(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900">
              <X size={20} />
            </button>
            <h3 className="font-bold text-lg text-neutral-900 mb-1">Appointment Details</h3>
            <p className="text-sm text-neutral-500 mb-4">{new Date(selectedAppt.scheduled_time).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            
            <div className="space-y-3">
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Patient Name</div>
                <div className="font-medium text-neutral-900">{selectedAppt.patient_name}</div>
              </div>
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Duration</div>
                <div className="font-medium text-neutral-900">{selectedAppt.duration_minutes} minutes</div>
              </div>
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Status</div>
                <div className="font-medium text-neutral-900 capitalize">{selectedAppt.status.replace('_', ' ')}</div>
              </div>
              {selectedAppt.notes && (
                <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Notes</div>
                  <div className="font-medium text-neutral-900 text-sm whitespace-pre-wrap">{selectedAppt.notes}</div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between gap-3">
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to delete this appointment?")) {
                    await deleteAppointment(selectedAppt.id);
                    qc.invalidateQueries({ queryKey: ["appointments"] });
                    setSelectedAppt(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 flex items-center gap-2 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedAppt(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    setSelectedAppt(null);
                    onEditAppt?.(selectedAppt);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 flex items-center gap-2 transition-colors"
                >
                  <Edit size={16} /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
