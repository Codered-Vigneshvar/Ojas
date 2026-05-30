import { Clock, CheckCircle2, Video, ArrowRight, Activity, Calendar } from "lucide-react";
import type { Appointment } from "@/types";

interface Props {
  appointment: Appointment;
  onViewConsultation: (patientId: string, consultationId: string) => void;
  onStartConsultation: (appointment: Appointment) => void;
  onFinishConsultation?: (appointment: Appointment) => void;
  onCancelConsultation?: (appointment: Appointment) => void;
  onDeleteAppointment?: (appointment: Appointment) => void;
}

export default function AppointmentCard({ appointment, onViewConsultation, onStartConsultation, onFinishConsultation, onCancelConsultation, onDeleteAppointment }: Props) {
  const scheduledDate = new Date(appointment.scheduled_time);
  
  const formattedTime = scheduledDate.toLocaleTimeString(undefined, { 
    hour: 'numeric', 
    minute: '2-digit'
  });

  // Calculate actual arrival time diff if present
  let arrivalText = null;
  if (appointment.actual_arrival_time) {
    const arrivalDate = new Date(appointment.actual_arrival_time);
    const diffMins = Math.floor((arrivalDate.getTime() - scheduledDate.getTime()) / 60000);
    const arrivalTimeString = arrivalDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    
    if (diffMins > 0) {
      arrivalText = `Started at ${arrivalTimeString} (${diffMins}m late)`;
    } else if (diffMins < 0) {
      arrivalText = `Started at ${arrivalTimeString} (${Math.abs(diffMins)}m early)`;
    } else {
      arrivalText = `Started exactly at ${arrivalTimeString}`;
    }
  }

  // Styles based on status
  let containerStyles = "";
  let badgeStyles = "";
  let icon = null;

  switch (appointment.status) {
    case "completed":
      containerStyles = "bg-neutral-50/50 border-neutral-100 opacity-80 hover:opacity-100";
      badgeStyles = "bg-neutral-100 text-neutral-500 border-neutral-200";
      icon = <CheckCircle2 size={14} />;
      break;
    case "in_consultation":
    case "arrived":
      containerStyles = "bg-orange-50/30 border-orange-200 shadow-sm shadow-orange-100/50";
      badgeStyles = "bg-orange-100 text-orange-700 border-orange-200";
      icon = <Activity size={14} className="animate-pulse" />;
      break;
    case "scheduled":
    default:
      containerStyles = "bg-white border-teal-100 hover:border-teal-300 shadow-sm";
      badgeStyles = "bg-teal-50 text-teal-700 border-teal-100";
      icon = <Calendar size={14} />;
      break;
  }

  return (
    <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200 group ${containerStyles}`}>
      
      {/* Time Column */}
      <div className="flex flex-col items-end min-w-[70px] pt-1">
        <span className="text-base font-bold text-neutral-900">{formattedTime}</span>
        <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">{appointment.duration_minutes} min</span>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-neutral-900 truncate">{appointment.patient_name}</h3>
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badgeStyles}`}>
            {icon}
            {appointment.status.replace("_", " ")}
          </span>
        </div>
        
        {appointment.notes && (
          <p className="text-sm text-neutral-500 line-clamp-1 mb-2">
            {appointment.notes}
          </p>
        )}
        
        {arrivalText && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium mb-3">
            <Clock size={12} />
            <span>{arrivalText}</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100/50">
          {(appointment.status === "completed" || (appointment.status === "in_consultation" && appointment.consultation_id)) ? (
            <>
              <button
                onClick={() => appointment.consultation_id && onViewConsultation(appointment.patient_id, appointment.consultation_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <ArrowRight size={14} />
                {appointment.status === "in_consultation" ? "Resume Consultation" : "View Consultation"}
              </button>
              {appointment.status === "in_consultation" && onFinishConsultation && (
                <button
                  onClick={() => onFinishConsultation(appointment)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <CheckCircle2 size={14} />
                  Finish
                </button>
              )}
              {appointment.status === "in_consultation" && onCancelConsultation && (
                <button
                  onClick={() => onCancelConsultation(appointment)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                >
                  Cancel Start
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onStartConsultation(appointment)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 active:scale-95 transition-all shadow-sm"
              >
                <Video size={14} />
                Start Consultation
              </button>
              
              {appointment.consultation_id && (
                <button
                  onClick={() => onViewConsultation(appointment.patient_id, appointment.consultation_id!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  View Notes
                </button>
              )}
              
              {onDeleteAppointment && (
                <button
                  onClick={() => onDeleteAppointment(appointment)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
