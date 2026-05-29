import { useState, useRef, useEffect } from "react";
import { X, Square, Pause, Play, Loader2, Sparkles, Trash2, Save } from "lucide-react";
import { useRecorder } from "@/hooks/useRecorder";
import Heartbeat from "@/components/Heartbeat";
import AudioPlayer from "@/components/AudioPlayer";
import { getArtifact, patchArtifact, deleteArtifact } from "@/lib/api";
import type { Artifact, StructuredNote } from "@/types";

interface Props {
  onSave: (blob: Blob, durationSeconds: number) => Promise<Artifact>;
  onClose: () => void;
}

type Step = "recording" | "paused" | "analyzing" | "review";

const NOTE_FIELDS: { key: keyof StructuredNote; label: string; multiline?: boolean }[] = [
  { key: "chief_complaint", label: "Chief Complaint" },
  { key: "clinical_findings", label: "Clinical Findings", multiline: true },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment_plan", label: "Treatment Plan", multiline: true },
  { key: "medications_prescribed", label: "Medications Prescribed", multiline: true },
  { key: "follow_up_instructions", label: "Follow-up Instructions" },
];

export default function RecordModal({ onSave, onClose }: Props) {
  const recorder = useRecorder();
  const [step, setStep] = useState<Step>("recording");
  const durationRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  // AI Review States
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [editedNote, setEditedNote] = useState<Partial<StructuredNote>>({});
  const [isFinalSaving, setIsFinalSaving] = useState(false);
  const [isFinalDeleting, setIsFinalDeleting] = useState(false);

  useEffect(() => {
    recorder.start();
    return () => {
      recorder.reset();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When recorder stops, transition to analyzing and start polling the artifact
  useEffect(() => {
    if (recorder.state === "stopping" && recorder.audioBlob && step === "recording") {
      setStep("analyzing");
      durationRef.current = recorder.durationSeconds;
      
      const processAudio = async () => {
        try {
          // Upload audio and get initial artifact
          const initialArtifact = await onSave(recorder.audioBlob!, durationRef.current);
          setArtifact(initialArtifact);
          setEditedTitle(initialArtifact.title);
          
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = URL.createObjectURL(recorder.audioBlob!);

          // Poll for transcript & structured note
          let attempts = 0;
          const maxAttempts = 30; // 45 seconds max
          const intervalId = setInterval(async () => {
            attempts++;
            try {
              const updated = await getArtifact(initialArtifact.id);
              if (updated.raw_transcript && updated.structured_note) {
                clearInterval(intervalId);
                setArtifact(updated);
                setEditedTitle(updated.title || "");
                setEditedNote(updated.structured_note);
                setEditedTranscript(updated.raw_transcript || "");
                setStep("review");
              } else if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                setArtifact(updated);
                setEditedTitle(updated.title || "");
                setEditedNote(updated.structured_note || {});
                setEditedTranscript(updated.raw_transcript || "");
                setStep("review");
              }
            } catch (err) {
              console.error("Error polling artifact:", err);
            }
          }, 1500);

        } catch (err) {
          console.error("Error saving audio artifact:", err);
          onClose();
        }
      };
      processAudio();
    }
  }, [recorder.state, recorder.audioBlob, step, onSave, onClose]);

  // Escape key closes modal (only when not saving/analyzing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "analyzing" && !isFinalSaving && !isFinalDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step, isFinalSaving, isFinalDeleting]);

  const handlePause = async () => {
    recorder.pause();
    setStep("paused");
  };

  const handleResume = () => {
    recorder.resume();
    setStep("recording");
  };

  const handleStop = () => {
    recorder.stop();
  };

  const handleFieldChange = (key: keyof StructuredNote, value: string) => {
    setEditedNote((prev) => ({ ...prev, [key]: value || null }));
  };

  const handleFinalSave = async () => {
    if (!artifact) return;
    setIsFinalSaving(true);
    try {
      await patchArtifact(artifact.id, {
        title: editedTitle || artifact.title,
        raw_transcript: editedTranscript,
        text_content: editedTranscript,
        structured_note: editedNote,
      });
      onClose();
    } catch (err) {
      console.error("Error saving updated snippet:", err);
    } finally {
      setIsFinalSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!artifact) {
      onClose();
      return;
    }
    if (!window.confirm("Are you sure you want to discard this recording?")) return;
    setIsFinalDeleting(true);
    try {
      await deleteArtifact(artifact.id);
      onClose();
    } catch (err) {
      console.error("Error deleting artifact:", err);
      onClose();
    } finally {
      setIsFinalDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          step !== "analyzing" &&
          !isFinalSaving &&
          !isFinalDeleting
        ) {
          onClose();
        }
      }}
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up flex flex-col transition-all duration-500 ease-out ${
          step === "review" ? "w-full max-w-5xl h-[85vh] md:h-[80vh]" : "w-full max-w-lg"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-teal-600"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </div>
            <h2 className="font-semibold text-neutral-900">
              {step === "recording" && "Recording Consultation"}
              {step === "paused" && "Recording Paused"}
              {step === "analyzing" && "AI Processing & Synthesis"}
              {step === "review" && "Review & Edit AI Note"}
            </h2>
          </div>
          {step !== "analyzing" && !isFinalSaving && !isFinalDeleting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Recording or Paused steps */}
        {(step === "recording" || step === "paused") && (
          <div className="px-5 py-8 flex flex-col items-center flex-1 justify-center">
            {/* Pulsing indicator */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-6">
              <div
                className={`absolute inset-0 bg-red-100 rounded-full ${
                  step === "recording" ? "animate-ping opacity-75" : "opacity-0"
                }`}
              />
              <div
                className={`absolute w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  step === "recording"
                    ? "bg-red-500 shadow-lg shadow-red-500/30"
                    : "bg-neutral-200"
                }`}
              >
                {step === "recording" && (
                  <div aria-live="polite" aria-label="Recording in progress" className="mt-2">
                    <Heartbeat level={recorder.levelNormalized} size={80} />
                  </div>
                )}
                {step === "paused" && <Pause size={24} className="text-neutral-500" fill="currentColor" />}
              </div>
            </div>

            {/* Timer */}
            <div className="text-4xl font-mono tracking-tight text-neutral-800 font-medium mb-10 tabular-nums">
              {new Date(recorder.durationSeconds * 1000).toISOString().substring(14, 19)}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              {step === "recording" ? (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 flex-1 justify-center py-2.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <Pause size={13} fill="currentColor" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-2 flex-1 justify-center py-2.5 text-xs font-medium text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                >
                  <Play size={13} fill="currentColor" />
                  Resume
                </button>
              )}
              <button
                onClick={handleStop}
                className="flex items-center gap-2 flex-1 justify-center py-2.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors"
              >
                <Square size={13} fill="currentColor" />
                Stop & Review
              </button>
            </div>
          </div>
        )}

        {/* Analyzing / AI processing state */}
        {step === "analyzing" && (
          <div className="px-5 py-12 flex flex-col items-center flex-1 justify-center text-center">
            <div className="relative w-16 h-16 flex items-center justify-center mb-6">
              <div className="absolute inset-0 border-4 border-teal-500/20 rounded-full animate-spin border-t-teal-600" />
              <Sparkles size={24} className="text-teal-600 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">Analyzing Voice Consultation...</h3>
            <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
              Our AI is transcribing the audio and organizing it into a structured clinical note. This takes just a few seconds.
            </p>
          </div>
        )}

        {/* Review step - SPACIOUS TWO-COLUMN WORKSPACE */}
        {step === "review" && (
          <>
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left pane: Audio & Raw Transcript */}
              <div className="flex-1 md:w-1/2 p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-neutral-100 space-y-6">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
                  1. Consultation Recording & Transcript
                </h3>

                {/* Audio Player */}
                {audioUrlRef.current && (
                  <div className="p-4 bg-neutral-50 border border-neutral-200/60 rounded-xl">
                    <AudioPlayer src={audioUrlRef.current} durationSeconds={durationRef.current} />
                  </div>
                )}

                {/* Label Title Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block ml-1">
                    Snippet Label / Title
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Sensible name labelled by AI"
                    className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 transition-all shadow-sm hover:shadow"
                  />
                </div>

                {/* Raw Transcript Editor */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block ml-1">
                    Raw Transcript text
                  </label>
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    rows={8}
                    className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 resize-y leading-relaxed font-mono transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Right pane: AI Structured Note */}
              <div className="flex-1 md:w-1/2 p-6 overflow-y-auto space-y-6 bg-neutral-50/50">
                <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                  2. AI Structured Clinical Note
                </h3>

                <div className="space-y-5">
                  {NOTE_FIELDS.map(({ key, label, multiline }) => {
                    const val = (editedNote[key] as string | null) ?? "";
                    return (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block ml-1">
                          {label}
                        </label>
                        {multiline ? (
                          <textarea
                            value={val}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            rows={3}
                            placeholder="—"
                            className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 resize-none leading-relaxed transition-all shadow-sm hover:shadow"
                          />
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            placeholder="—"
                            className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 transition-all shadow-sm hover:shadow"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer / Action bar */}
            <div className="px-6 py-4 border-t border-neutral-100 bg-white flex justify-between items-center flex-shrink-0">
              <button
                onClick={handleDiscard}
                disabled={isFinalSaving || isFinalDeleting}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-all disabled:opacity-40"
              >
                {isFinalDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Discard
              </button>

              <button
                onClick={handleFinalSave}
                disabled={isFinalSaving || isFinalDeleting}
                className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-all shadow-md shadow-neutral-900/20 disabled:opacity-40"
              >
                {isFinalSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {isFinalSaving ? "Saving..." : "Save Snippet"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
