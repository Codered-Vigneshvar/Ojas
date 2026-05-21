import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Download, FileText, Trash2 } from "lucide-react";
import type { Artifact } from "@/types";
import { getDownloadUrl, patchArtifact, deleteArtifact } from "@/lib/api";
import { formatTimelineDate } from "@/lib/time";
import AudioPlayer from "@/components/AudioPlayer";

interface Props {
  artifact: Artifact;
  onClose: () => void;
  onUpdate?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  report: "Report",
  image: "Image",
  file: "File",
  note: "Note",
  audio: "Audio",
  prescription: "Prescription",
};

export default function ArtifactDetailModal({ artifact, onClose, onUpdate }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState(artifact.title || "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: downloadUrl } = useQuery({
    queryKey: ["download-url", artifact.id],
    queryFn: () => getDownloadUrl(artifact.id),
    enabled: !!artifact.storage_key,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: () => patchArtifact(artifact.id, { title }),
    onSuccess: () => {
      setEditing(false);
      onUpdate?.();
      qc.invalidateQueries({ queryKey: ["artifacts", artifact.patient_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteArtifact(artifact.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artifacts", artifact.patient_id] });
      onUpdate?.();
      onClose();
    },
  });

  const isNote = artifact.type === "note";
  const isAudio = artifact.type === "audio";
  const isImage = artifact.type === "image";
  const isPdf = artifact.mime_type === "application/pdf";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-neutral-400 uppercase tracking-wide">
                {TYPE_LABELS[artifact.type] ?? artifact.type}
              </span>
              <span className="text-xs font-mono text-neutral-300">·</span>
              <span className="text-xs font-mono text-neutral-400">
                {formatTimelineDate(artifact.created_at)}
              </span>
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-semibold text-neutral-900 text-lg leading-tight border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:border-neutral-400"
                  autoFocus
                />
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="px-3 py-1 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg disabled:opacity-40"
                >
                  {saveMutation.isPending ? "…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setTitle(artifact.title); }}
                  className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <h3
                className="font-semibold text-neutral-900 text-lg leading-tight truncate cursor-pointer hover:text-neutral-700"
                onClick={() => setEditing(true)}
                title="Click to edit title"
              >
                {artifact.title}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                title="Download"
              >
                <Download size={16} />
              </a>
            )}
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this? This action cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* tab bar — single Document tab */}
        <div className="flex border-b border-neutral-100 px-6 bg-neutral-50/50 flex-shrink-0">
          <div className="py-3 px-4 text-xs font-semibold tracking-tight border-b-2 border-neutral-900 text-neutral-900 flex items-center gap-2">
            <FileText size={14} />
            Document
          </div>
        </div>

        {/* content */}
        <div className="flex-1 overflow-auto p-6">
          {isNote && (
            <pre className="text-sm text-neutral-800 whitespace-pre-wrap font-sans leading-relaxed bg-neutral-50 p-4 rounded-xl border border-neutral-100">
              {artifact.text_content || "No content"}
            </pre>
          )}
          {isAudio && (
            <div className="space-y-4">
              {downloadUrl && (
                <AudioPlayer src={downloadUrl} durationSeconds={artifact.duration_seconds || 0} />
              )}
              {artifact.text_content && (
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Transcript</p>
                  <pre className="text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed font-sans bg-neutral-50 rounded-xl px-4 py-3 border border-neutral-100">
                    {artifact.text_content}
                  </pre>
                </div>
              )}
            </div>
          )}
          {isImage && downloadUrl && (
            <img src={downloadUrl} alt={artifact.title} className="max-w-full max-h-[55vh] object-contain rounded-lg mx-auto block shadow-sm border border-neutral-200" />
          )}
          {isPdf && downloadUrl && (
            <iframe src={downloadUrl} title={artifact.title} className="w-full rounded-lg border border-neutral-100" style={{ height: "55vh" }} />
          )}
          {!isNote && !isAudio && !isImage && !isPdf && !downloadUrl && artifact.storage_key && (
            <div className="flex items-center justify-center h-48 text-neutral-400">
              <p className="text-sm">Preview not available for this file type.</p>
            </div>
          )}

          {/* Summary row */}
          {artifact.summary && (
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-1">Summary</p>
              <p className="text-sm text-neutral-600">{artifact.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
