import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, Mic, StickyNote, MessageSquare, Sparkles, FileText } from "lucide-react";
import {
  getPatient,
  listArtifacts,
  uploadFile,
  createNote,
  saveAudioArtifact,
} from "@/lib/api";
import type { Artifact } from "@/types";
import ArtifactTimeline from "@/components/PatientWorkspace/ArtifactTimeline";
import NoteModal from "@/components/PatientWorkspace/NoteModal";
import RecordModal from "@/components/PatientWorkspace/RecordModal";
import ArtifactDetailModal from "@/components/PatientWorkspace/ArtifactDetailModal";

type Modal = "note" | "record" | null;

export default function PatientPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId!),
    enabled: !!patientId,
  });

  const { data: artifacts = [], isLoading: artifactsLoading } = useQuery({
    queryKey: ["artifacts", patientId],
    queryFn: () => listArtifacts(patientId!),
    enabled: !!patientId,
  });

  const invalidateArtifacts = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["artifacts", patientId] });
  }, [qc, patientId]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(patientId!, file),
    onSuccess: invalidateArtifacts,
  });

  const noteMutation = useMutation({
    mutationFn: (text: string) => createNote(patientId!, text),
    onSuccess: () => {
      invalidateArtifacts();
      setActiveModal(null);
    },
  });

  const audioMutation = useMutation({
    mutationFn: ({ blob, duration }: { blob: Blob; duration: number }) =>
      saveAudioArtifact(patientId!, blob, duration),
    onSuccess: () => {
      invalidateArtifacts();
      setActiveModal(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  };

  const firstName = patient?.name?.split(" ")[0] ?? "Patient";

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-200 border-t-neutral-600 animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-neutral-600">Patient not found.</p>
        <button onClick={() => navigate("/")} className="text-sm underline text-neutral-500">
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden relative">
      {/* top bar */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-white/85 backdrop-blur-md z-10 shadow-xs">
        <div className="h-14 flex items-center px-4">
          <Link
            to="/"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors mr-3"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900 text-base tracking-tight">Ojas</span>
            <span className="px-2 py-0.5 rounded-md border border-neutral-200 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Starter Kit
            </span>
          </div>
          <div className="flex-1" />
          <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xs font-semibold select-none">
            DR
          </div>
        </div>
      </header>

      {/* workspace body */}
      <div className="flex-1 flex overflow-hidden">
        {/* left rail — artifact timeline */}
        <div className="w-[340px] flex-shrink-0 border-r border-neutral-200 bg-white flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-neutral-100 flex-shrink-0">
            <h2 className="text-sm font-bold text-neutral-800 truncate tracking-tight">{patient.name}</h2>
            <p className="text-xs font-mono text-neutral-400 mt-0.5">
              {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {artifactsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-neutral-50 animate-shimmer" />
                ))}
              </div>
            ) : (
              <ArtifactTimeline artifacts={artifacts} onArtifactClick={setSelectedArtifact} />
            )}
          </div>
          {uploadMutation.isPending && (
            <div className="px-4 py-2 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-500">
              <div className="w-3 h-3 rounded-full border border-neutral-300 border-t-neutral-600 animate-spin" />
              Uploading…
            </div>
          )}
        </div>

        {/* right — workspace panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* main content area */}
          <div className="flex-1 flex flex-col items-center justify-center px-8">
            <div className="max-w-md text-center">
              <div className="p-3 bg-neutral-900 text-white rounded-2xl mb-6 shadow-md shadow-neutral-900/10 mx-auto w-fit">
                <FileText size={24} />
              </div>
              <h2 className="text-3xl font-bold text-neutral-900 tracking-tight">
                {firstName}'s workspace
              </h2>
              <p className="mt-2 text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Upload documents, record consultations, or write clinical notes.
                All artifacts are stored securely and scoped to this patient.
              </p>

              {/* action cards */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2.5 px-4 py-5 rounded-2xl border border-neutral-200/80 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 transition-all shadow-sm hover:shadow active:scale-[0.98] group"
                >
                  <Upload size={20} className="text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                  <span className="text-xs font-semibold">Upload</span>
                </button>
                <button
                  onClick={() => setActiveModal("record")}
                  className="flex flex-col items-center gap-2.5 px-4 py-5 rounded-2xl border border-neutral-200/80 bg-white text-neutral-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 transition-all shadow-sm hover:shadow active:scale-[0.98] group"
                >
                  <Mic size={20} className="text-neutral-400 group-hover:text-teal-600 transition-colors" />
                  <span className="text-xs font-semibold">Record</span>
                </button>
                <button
                  onClick={() => setActiveModal("note")}
                  className="flex flex-col items-center gap-2.5 px-4 py-5 rounded-2xl border border-neutral-200/80 bg-white text-neutral-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 transition-all shadow-sm hover:shadow active:scale-[0.98] group"
                >
                  <StickyNote size={20} className="text-neutral-400 group-hover:text-amber-600 transition-colors" />
                  <span className="text-xs font-semibold">Note</span>
                </button>
              </div>

              {/* AI coming soon placeholder */}
              <div className="mt-10 p-5 rounded-2xl border border-dashed border-neutral-300 bg-gradient-to-b from-neutral-50 to-white">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles size={16} className="text-neutral-400" />
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">AI Extension Point</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  This starter kit is ready for AI capabilities.
                  Add an LLM module, embedding pipeline, or RAG system
                  to unlock intelligent search, auto-labelling, and clinical chat.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <MessageSquare size={13} className="text-neutral-300" />
                  <span className="text-[11px] text-neutral-300 font-mono">Chat • Search • Summarize • Label</span>
                </div>
              </div>
            </div>
          </div>

          {/* bottom bar */}
          <div className="border-t border-neutral-100 bg-white px-4 py-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
              >
                <Upload size={14} />
                Upload
              </button>
              <button
                onClick={() => setActiveModal("record")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
              >
                <Mic size={14} />
                Record
              </button>
              <button
                onClick={() => setActiveModal("note")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
              >
                <StickyNote size={14} />
                Note
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="*/*"
            />
          </div>
        </div>
      </div>

      {/* modals */}
      {activeModal === "note" && (
        <NoteModal
          onClose={() => setActiveModal(null)}
          isSaving={noteMutation.isPending}
          onSave={async (text) => {
            noteMutation.mutate(text);
          }}
        />
      )}
      {activeModal === "record" && (
        <RecordModal
          patientId={patientId!}
          onClose={() => setActiveModal(null)}
          isSaving={audioMutation.isPending}
          onSave={async (blob, duration) => {
            audioMutation.mutate({ blob, duration });
          }}
        />
      )}
      {selectedArtifact && (
        <ArtifactDetailModal
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
          onUpdate={invalidateArtifacts}
        />
      )}
    </div>
  );
}
