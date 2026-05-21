import { useNavigate } from "react-router-dom";
import { Phone, Clock, ChevronRight } from "lucide-react";
import type { Patient } from "@/types";
import { avatarColor, avatarInitials } from "@/lib/avatar";
import { formatPhone } from "@/lib/phone";
import { timeAgo } from "@/lib/time";
import { openPatient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  patient: Patient;
}

export default function PatientRow({ patient }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleClick = async () => {
    try {
      await openPatient(patient.id);
      qc.invalidateQueries({ queryKey: ["patients", "recent"] });
    } catch {
      // non-fatal — workspace still opens
    }
    navigate(`/p/${patient.id}`);
  };

  const initials = avatarInitials(patient.name);
  const colorClass = avatarColor(patient.name);

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50 transition-colors group text-left"
    >
      {/* avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${colorClass} transition-transform group-hover:scale-105`}
      >
        {initials}
      </div>

      {/* name + condition */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-neutral-900 text-sm truncate">{patient.name}</p>
        <p className="text-xs text-neutral-400 truncate mt-0.5">
          {patient.artifact_count > 0
            ? `${patient.artifact_count} artifact${patient.artifact_count !== 1 ? "s" : ""}`
            : "No artifacts yet"}
        </p>
      </div>

      {/* phone */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-500 font-mono min-w-0 flex-shrink-0">
        <Phone size={12} className="flex-shrink-0 text-neutral-400" />
        <span>{formatPhone(patient.phone_e164)}</span>
      </div>

      {/* last accessed */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 font-mono min-w-0 flex-shrink-0 w-28 justify-end">
        <Clock size={12} className="flex-shrink-0" />
        <span>{timeAgo(patient.last_accessed_at)}</span>
      </div>

      {/* chevron */}
      <ChevronRight
        size={16}
        className="flex-shrink-0 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all"
      />
    </button>
  );
}
