import { FileText, Mic, Image as ImageIcon, File, Syringe, Pill, CheckCircle2 } from "lucide-react";
import type { Artifact } from "@/types";
import { timeAgo } from "@/lib/time";

interface Props {
  snippet: Artifact;
  isActive: boolean;
  isRead: boolean;
  onClick: () => void;
}

export default function SnippetCard({ snippet, isActive, isRead, onClick }: Props) {
  const ageMs = Date.now() - new Date(snippet.created_at).getTime();
  const isTimedOut = ageMs > 120000;

  const isProcessing = !isTimedOut && (
    (snippet.type === "audio" && !snippet.structured_note) || 
    ((snippet.type === "image" || snippet.type === "prescription" || (snippet.mime_type && snippet.mime_type.startsWith("image/"))) && snippet.prescription_ocr_text === null) ||
    (snippet.title && snippet.title.includes(".") && (snippet.type === "file" || snippet.type === "image" || snippet.type === "prescription" || snippet.type === "report"))
  );

  const isUnread = !isProcessing && !isRead;

  // If title is default generated, use a generic fallback in the UI until AI labels it.
  const displayTitle = snippet.title;

  const isConfirmed = !!snippet.doctor_confirmed_at;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 hover:bg-neutral-50 transition-colors flex items-start gap-3 relative
        ${isActive ? "bg-teal-50/50" : isProcessing ? "bg-neutral-50/80 border-l border-neutral-200" : "bg-white"}
      `}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
      )}

      {/* Icon */}
      <div className={`
        p-2 rounded-xl flex-shrink-0 mt-0.5
        ${snippet.type === "audio" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
          snippet.type === "note" ? "bg-amber-50 text-amber-600 border border-amber-100" :
          snippet.type === "prescription" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
          snippet.type === "image" ? "bg-blue-50 text-blue-600 border border-blue-100" :
          "bg-neutral-100 text-neutral-600 border border-neutral-200"}
      `}>
        {snippet.type === "audio" && <Mic size={16} />}
        {snippet.type === "note" && <FileText size={16} />}
        {snippet.type === "prescription" && <Pill size={16} />}
        {snippet.type === "image" && <ImageIcon size={16} />}
        {snippet.type === "file" && <File size={16} />}
        {snippet.type === "report" && <Syringe size={16} />}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold truncate flex items-center gap-2 ${isActive ? "text-teal-900" : "text-neutral-900"}`}>
            {displayTitle}
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" title="Unread Snippet" />
            )}
          </p>
          <span className="text-[10px] text-neutral-400 whitespace-nowrap mt-0.5">
            {timeAgo(snippet.created_at)}
          </span>
        </div>

        {/* Snippet type badge & confirmation status */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px] font-bold bg-neutral-100 text-neutral-500">
            {snippet.type}
          </span>
          {isConfirmed && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-600">
              <CheckCircle2 size={10} /> Confirmed
            </span>
          )}
        </div>

        {/* Short preview of content or processing text */}
        {isProcessing ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-pulse" />
            <span className="text-xs text-neutral-500 italic">Processing...</span>
          </div>
        ) : snippet.summary && (
          <p className="text-xs text-neutral-500 truncate mt-0.5">
            {snippet.summary}
          </p>
        )}
      </div>
    </button>
  );
}
