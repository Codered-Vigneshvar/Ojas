import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, CalendarPlus, Mic, StickyNote, Activity } from "lucide-react";
import { listAppointments, startConsultation, deleteAppointment, patchAppointment } from "@/lib/api";
import { greeting } from "@/lib/time";
import type { Appointment } from "@/types";

import DayPicker from "@/components/Dashboard/DayPicker";
import AppointmentCard from "@/components/Dashboard/AppointmentCard";
import BookAppointmentModal from "@/components/Dashboard/BookAppointmentModal";
import CalendarModal from "@/components/Dashboard/CalendarModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBookModal, setShowBookModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [initialBookTime, setInitialBookTime] = useState<string>("09:00");
  const [bookDate, setBookDate] = useState(new Date());
  const [editAppt, setEditAppt] = useState<Appointment | null>(null);
  
  // Modals for Quick actions
  const [showPatientSelectAction, setShowPatientSelectAction] = useState<"note" | "audio" | null>(null);
  
  const dateStr = selectedDate.toLocaleDateString("en-CA"); // YYYY-MM-DD local

  const { data: allAppointments = [], isLoading } = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => listAppointments(),
    staleTime: 5000,
  });

  const appointments = useMemo(() => {
    return allAppointments.filter(appt => {
      const d = new Date(appt.scheduled_time);
      return d.toLocaleDateString("en-CA") === dateStr;
    });
  }, [allAppointments, dateStr]);

  const handleStartConsultation = async (appt: Appointment) => {
    const activeAppt = allAppointments.find(a => a.status === "in_consultation");
    if (activeAppt && activeAppt.id !== appt.id) {
      alert(`You are currently seeing ${activeAppt.patient_name || "another patient"}. If you want to consult another patient, please click on 'Finish Consultation' on that patient and come back here.`);
      return;
    }

    try {
      const res = await startConsultation(appt.id);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      // Navigate to patient workspace with active consultation
      navigate(`/p/${appt.patient_id}`, { state: { activeConsultationId: res.consultation_id } });
    } catch (e) {
      console.error(e);
      alert("Failed to start consultation");
    }
  };

  const handleViewConsultation = (patientId: string, consultationId: string) => {
    // Navigate to patient workspace
    navigate(`/p/${patientId}`, { state: { activeConsultationId: consultationId } });
  };

  const handleFinishConsultation = async (appt: Appointment) => {
    try {
      await patchAppointment(appt.id, { status: "completed" });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    } catch (e) {
      console.error(e);
      alert("Failed to finish consultation");
    }
  };

  const handleCancelConsultation = async (appt: Appointment) => {
    if (confirm("Are you sure you want to cancel the start of this consultation? This will reset the appointment status and delete the active consultation record.")) {
      try {
        await patchAppointment(appt.id, {
          status: "scheduled",
          consultation_id: null,
          actual_arrival_time: null,
        });
        qc.invalidateQueries({ queryKey: ["appointments"] });
      } catch (e) {
        console.error(e);
        alert("Failed to cancel consultation");
      }
    }
  };

  const handleDeleteAppointment = async (appt: Appointment) => {
    if (confirm(`Are you sure you want to delete the appointment for ${appt.patient_name}?`)) {
      try {
        await deleteAppointment(appt.id);
        qc.invalidateQueries({ queryKey: ["appointments"] });
      } catch (e) {
        console.error(e);
        alert("Failed to delete appointment");
      }
    }
  };

  const handleCancelAppointment = async (appt: Appointment) => {
    if (confirm(`Are you sure you want to cancel the appointment for ${appt.patient_name}? The record will be kept but marked as cancelled.`)) {
      try {
        await patchAppointment(appt.id, { status: "cancelled" });
        qc.invalidateQueries({ queryKey: ["appointments"] });
      } catch (e) {
        console.error(e);
        alert("Failed to cancel appointment");
      }
    }
  };

  const handleRescheduleAppointment = (appt: Appointment) => {
    setBookDate(new Date(appt.scheduled_time));
    setEditAppt(appt);
    setShowBookModal(true);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* top bar */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-md sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <span className="font-bold text-neutral-900 text-base tracking-tight">Ojas</span>
            <span className="px-2 py-0.5 rounded-md border border-neutral-200 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Clinic
            </span>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/patients")}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              All Patients
            </button>
            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xs font-semibold select-none">
              DR
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-10 animate-fade-in">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
              {greeting()}, Dr Sreekanth.
            </h1>
            <p className="mt-2 text-sm text-neutral-500 max-w-sm">
              Here is your schedule for the day. You can book new appointments or start consultations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DayPicker date={selectedDate} onChange={setSelectedDate} />
            <div className="flex items-center bg-white rounded-xl shadow-sm border border-neutral-200 p-1">
              <button
                onClick={() => setShowCalendarModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors whitespace-nowrap"
              >
                View Full Calendar
              </button>
              <div className="w-px h-5 bg-neutral-200 mx-1" />
              <button
                onClick={() => {
                  setBookDate(selectedDate);
                  setInitialBookTime("09:00");
                  setEditAppt(null);
                  setShowBookModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-all active:scale-95 whitespace-nowrap"
              >
                <CalendarPlus size={15} />
                Book
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Schedule Column */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900">What's for Today</h2>
              <span className="px-2 py-0.5 rounded-full bg-neutral-200/50 text-xs font-mono text-neutral-600 font-medium">
                {appointments.length}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 bg-white border border-neutral-100 rounded-2xl animate-shimmer" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-16 px-6 text-center bg-white border border-neutral-200 border-dashed rounded-3xl">
                <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neutral-100">
                  <Activity size={24} className="text-neutral-300" />
                </div>
                <h3 className="text-base font-semibold text-neutral-900 mb-1">No appointments yet</h3>
                <p className="text-sm text-neutral-500 max-w-sm mx-auto mb-6">
                  You have a free schedule. Click book to add a new appointment.
                </p>
                <button
                  onClick={() => {
                    setBookDate(selectedDate);
                    setInitialBookTime("09:00");
                    setEditAppt(null);
                    setShowBookModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors"
                >
                  <CalendarPlus size={16} />
                  Book Appointment
                </button>
              </div>
            ) : (
              <div className="space-y-4 relative stagger-children">
                {/* Timeline continuous line */}
                <div className="absolute left-[88px] top-4 bottom-4 w-px bg-neutral-200 -z-10" />
                
                {appointments.map((appt) => (
                  <div key={appt.id} className="animate-fade-in bg-white rounded-2xl z-10 relative shadow-xs">
                    <AppointmentCard 
                      appointment={appt} 
                      onViewConsultation={handleViewConsultation}
                      onStartConsultation={handleStartConsultation}
                      onFinishConsultation={handleFinishConsultation}
                      onCancelConsultation={handleCancelConsultation}
                      onDeleteAppointment={handleDeleteAppointment}
                      onCancelAppointment={handleCancelAppointment}
                      onRescheduleAppointment={handleRescheduleAppointment}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions & Side Panel Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm sticky top-20">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 uppercase tracking-wider">Quick Actions</h3>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowPatientSelectAction("note")}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-200 hover:border-teal-300 hover:bg-teal-50/30 hover:shadow-md transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-100 transition-colors">
                    <StickyNote size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900 group-hover:text-teal-800 transition-colors text-sm">Write Note</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Quickly jot down patient details</div>
                  </div>
                </button>
                
                <button
                  onClick={() => setShowPatientSelectAction("audio")}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-200 hover:border-orange-300 hover:bg-orange-50/30 hover:shadow-md transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:bg-orange-100 transition-colors">
                    <Mic size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900 group-hover:text-orange-800 transition-colors text-sm">Record Audio</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Dictate or record a live session</div>
                  </div>
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-100">
                <button
                  onClick={() => navigate("/patients")}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-50 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 group-hover:bg-neutral-200 group-hover:text-neutral-700 transition-colors">
                      <Search size={14} />
                    </div>
                    <span className="text-sm font-medium text-neutral-700">Search Patient Directory</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showBookModal && (
        <BookAppointmentModal 
          selectedDate={bookDate}
          initialTimeStr={initialBookTime}
          editAppointment={editAppt}
          onClose={() => {
            setShowBookModal(false);
            setEditAppt(null);
          }} 
          onSuccess={() => {
            setShowBookModal(false);
            setEditAppt(null);
            qc.invalidateQueries({ queryKey: ["appointments"] });
          }} 
        />
      )}

      {showCalendarModal && (
        <CalendarModal
          initialDate={selectedDate}
          onClose={() => setShowCalendarModal(false)}
          onSlotClick={(date, timeStr) => {
            setBookDate(date);
            setInitialBookTime(timeStr);
            setEditAppt(null);
            setShowBookModal(true);
          }}
          onEditAppt={(appt) => {
            setBookDate(new Date(appt.scheduled_time));
            setEditAppt(appt);
            setShowBookModal(true);
          }}
        />
      )}

      {/* For Quick Actions, if they click from dashboard we should really just take them to a simplified patient selector. For now, redirecting to patient search is easiest, but ideally we show a mini modal. I'll just redirect to /patients for simplicity right now if they want to create an artifact without being in the workspace. */}
      {showPatientSelectAction !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm text-center">
            <h3 className="font-bold text-lg mb-2">Select a Patient First</h3>
            <p className="text-sm text-neutral-500 mb-6">To {showPatientSelectAction === "note" ? "write a note" : "record audio"}, please open a patient's workspace first.</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowPatientSelectAction(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-xl hover:bg-neutral-200"
              >
                Cancel
              </button>
              <button 
                onClick={() => navigate("/patients")}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700"
              >
                Go to Patients
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
