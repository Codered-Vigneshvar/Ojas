import { FileText, Plus, Video, Play, Square, Edit2, Trash2 } from "lucide-react";
import type { Consultation, Appointment } from "@/types";
import { timeAgo } from "@/lib/time";

interface Props {
  consultations: Consultation[];
  appointments: Appointment[];
  onSelect: (consultation: Consultation) => void;
  onCreateNew: () => void;
  onStartScheduled: (appointment: Appointment) => void;
  onUpdateStatus: (appointmentId: string, status: "completed" | "in_consultation") => void;
  onResetStart: (appointmentId: string) => void;
  onClose: () => void;
  onEditTitle: (consultationId: string, title: string) => void;
  onDeleteConsultation: (consultationId: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (appointmentId: string) => void;
}

export default function ConsultationHistory({
  consultations,
  appointments,
  onSelect,
  onCreateNew,
  onStartScheduled,
  onUpdateStatus,
  onResetStart,
  onEditTitle,
  onDeleteConsultation,
  onEditAppointment,
  onDeleteAppointment,
}: Props) {
  const scheduledAppointments = appointments.filter(a => a.status === "scheduled");
  return (
    <div className="flex-1 w-full h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-8 py-12 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Consultation History</h2>
          <p className="text-sm text-neutral-500 mt-1">Select a past consultation or start a new one.</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Consultation
        </button>
      </div>

      <div className="space-y-3">
        {scheduledAppointments.map(appt => (
          <div key={appt.id} className="w-full text-left p-5 bg-teal-50/50 border border-teal-100 rounded-2xl flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-teal-900">{appt.notes || "Scheduled Appointment"}</h3>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-teal-700 font-medium">
                <span>{new Date(appt.scheduled_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>•</span>
                <span>{new Date(appt.scheduled_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onStartScheduled(appt)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 active:scale-95 transition-all shadow-sm"
              >
                <Video size={14} />
                Start Consultation
              </button>
              <div className="flex items-center gap-1 border-l border-teal-200 pl-3 ml-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAppointment(appt);
                  }}
                  className="p-1.5 text-teal-700 hover:text-teal-900 hover:bg-teal-100 rounded-lg transition-colors"
                  title="Edit appointment"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this scheduled appointment?")) {
                      onDeleteAppointment(appt.id);
                    }
                  }}
                  className="p-1.5 text-teal-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete appointment"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {consultations.length === 0 && scheduledAppointments.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-neutral-100">
              <FileText size={20} className="text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-900">No consultations yet</p>
            <p className="text-xs text-neutral-500 mt-1 mb-4">Start a new consultation to begin taking notes.</p>
            <button
              onClick={onCreateNew}
              className="text-sm font-medium text-teal-600 hover:text-teal-700 underline underline-offset-4"
            >
              Start first consultation
            </button>
          </div>
        ) : (
          consultations.map((consultation) => {
            const appt = appointments.find(a => a.consultation_id === consultation.id);
            return (
              <div
                key={consultation.id}
                className="w-full text-left p-5 bg-white border border-neutral-200 rounded-2xl hover:border-teal-300 hover:shadow-md transition-all group flex items-start justify-between cursor-pointer"
                onClick={() => onSelect(consultation)}
              >
                <div>
                  <h3 className="font-semibold text-neutral-900 group-hover:text-teal-800 transition-colors">
                    {consultation.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500 font-medium">
                    <span>{new Date(consultation.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{timeAgo(consultation.created_at)}</span>
                    <span>•</span>
                    <span>{consultation.artifact_count} snippet{consultation.artifact_count !== 1 ? 's' : ''}</span>
                  </div>
                  {consultation.notes && (
                    <p className="text-sm text-neutral-600 mt-3 line-clamp-2">
                      {consultation.notes}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  {appt && appt.status === "in_consultation" && (
                    <>
                      {consultation.artifact_count === 0 && (
                        <button
                          onClick={() => onResetStart(appt.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors shadow-sm active:scale-95"
                        >
                          Reset Start
                        </button>
                      )}
                      <button
                        onClick={() => onUpdateStatus(appt.id, "completed")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-colors shadow-sm active:scale-95"
                      >
                        <Square size={12} className="fill-white" />
                        Finish
                      </button>
                    </>
                  )}
                  {appt && appt.status === "completed" && (
                    <button
                      onClick={() => onUpdateStatus(appt.id, "in_consultation")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 text-xs font-bold rounded-lg hover:bg-neutral-50 transition-colors shadow-sm active:scale-95"
                    >
                      <Play size={12} className="fill-neutral-700" />
                      Resume
                    </button>
                  )}
                  <div className="flex items-center gap-1 border-l border-neutral-200 pl-3 ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTitle = prompt("Enter new consultation title:", consultation.title);
                        if (newTitle && newTitle.trim() !== consultation.title) {
                          onEditTitle(consultation.id, newTitle.trim());
                        }
                      }}
                      className="p-1.5 text-neutral-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Edit title"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this consultation?\n\nWARNING: This will also permanently delete the associated appointment block from your calendar. This action cannot be undone.")) {
                          onDeleteConsultation(consultation.id);
                        }
                      }}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete consultation"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors pointer-events-none">
                    <FileText size={16} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}
