import { File, FileText, Image, Mic, Pill, StickyNote } from "lucide-react";
import { formatTimelineDate } from "@/lib/time";
import type { Artifact } from "@/types";

const TYPE_CONFIG = {
  report:    { label: "Report",       bg: "bg-violet-50",  text: "text-violet-800",  border: "border-violet-200",  icon: FileText, iconColor: "text-violet-500"  },
  image:     { label: "Image",        bg: "bg-indigo-50",  text: "text-indigo-800",  border: "border-indigo-200",  icon: Image,    iconColor: "text-indigo-500"  },
  file:      { label: "File",         bg: "bg-neutral-100",text: "text-neutral-700", border: "border-neutral-200", icon: File,     iconColor: "text-neutral-500" },
  note:      { label: "Note",         bg: "bg-amber-50",   text: "text-amber-900",   border: "border-amber-200",   icon: StickyNote,iconColor: "text-amber-500" },
  audio:     { label: "Audio",        bg: "bg-teal-50",    text: "text-teal-900",    border: "border-teal-200",    icon: Mic,      iconColor: "text-teal-500"    },
  prescription:{ label: "Prescription",bg:"bg-emerald-50",text: "text-emerald-900", border: "border-emerald-200", icon: Pill,     iconColor: "text-emerald-500" },
} as const;

interface Props {
  artifact: Artifact;
  onClick: (artifact: Artifact) => void;
}

export default function ArtifactCard({ artifact, onClick }: Props) {
  const typeCfg = TYPE_CONFIG[artifact.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.file;
  const Icon = typeCfg.icon;

  return (
    <button
      onClick={() => onClick(artifact)}
      className="w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-200 animate-fade-in bg-white border-neutral-100 hover:border-neutral-200 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-mono font-medium ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}
        >
          <Icon size={11} className={typeCfg.iconColor} />
          {typeCfg.label}
        </span>

        <span className="text-xs font-mono text-neutral-400">
          {formatTimelineDate(artifact.created_at)}
        </span>
      </div>

      <p className="mt-2 font-semibold text-sm truncate leading-snug text-neutral-800">
        {artifact.title}
      </p>

      {artifact.summary && (
        <p className="mt-0.5 text-xs text-neutral-400 truncate">{artifact.summary}</p>
      )}
    </button>
  );
}
