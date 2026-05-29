import { FileText, Plus } from "lucide-react";
import type { Consultation } from "@/types";
import { timeAgo } from "@/lib/time";

interface Props {
  consultations: Consultation[];
  onSelect: (consultation: Consultation) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export default function ConsultationHistory({
  consultations,
  onSelect,
  onCreateNew,
}: Props) {
  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-8 py-12 animate-fade-in">
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
        {consultations.length === 0 ? (
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
          consultations.map((consultation) => (
            <button
              key={consultation.id}
              onClick={() => onSelect(consultation)}
              className="w-full text-left p-5 bg-white border border-neutral-200 rounded-2xl hover:border-teal-300 hover:shadow-md transition-all group flex items-start justify-between"
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
              <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                <FileText size={16} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
