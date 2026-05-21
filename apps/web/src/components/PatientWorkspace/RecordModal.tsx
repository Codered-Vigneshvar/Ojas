import { useState, useRef, useEffect } from "react";
import { X, Square, Mic, Trash2, Save } from "lucide-react";
import { useRecorder } from "@/hooks/useRecorder";
import Heartbeat from "@/components/Heartbeat";
import AudioPlayer from "@/components/AudioPlayer";

type Step = "recording" | "review";

interface Props {
  patientId: string;
  onSave: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RecordModal({ onSave, onClose, isSaving }: Props) {
  const recorder = useRecorder();
  const [step, setStep] = useState<Step>("recording");
  const audioBlobRef = useRef<Blob | null>(null);
  const durationRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  // Start recording immediately on mount
  useEffect(() => {
    recorder.start();
    return () => { recorder.reset(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When recorder goes to "stopping" state, blob is ready — move to review
  useEffect(() => {
    if (recorder.state === "stopping" && recorder.audioBlob) {
      audioBlobRef.current = recorder.audioBlob;
      durationRef.current = recorder.durationSeconds;
      
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(recorder.audioBlob);
      setStep("review");
    }
  }, [recorder.state, recorder.audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!audioBlobRef.current) return;
    await onSave(audioBlobRef.current, durationRef.current);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200">
              <Mic size={15} className="text-teal-600" />
            </div>
            <span className="text-sm font-semibold text-neutral-800">
              {step === "recording" && "Recording"}
              {step === "review" && "Review & save"}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* recording state */}
        {step === "recording" && (
          <div className="flex flex-col items-center justify-center gap-6 px-8 py-12">
            {recorder.state === "requesting_mic" && (
              <p className="text-sm text-neutral-500 animate-pulse">Requesting microphone access…</p>
            )}
            {recorder.state === "error" && (
              <div className="text-center">
                <p className="text-sm text-red-600 font-medium">{recorder.errorMessage}</p>
                <button onClick={onClose} className="mt-4 text-xs text-neutral-500 underline">Close</button>
              </div>
            )}
            {recorder.state === "recording" && (
              <>
                <div aria-live="polite" aria-label="Recording in progress">
                  <Heartbeat level={recorder.levelNormalized} size={96} />
                </div>
                <p className="text-4xl font-mono font-light text-neutral-800 tabular-nums">
                  {formatDuration(recorder.durationSeconds)}
                </p>
                <button
                  onClick={recorder.stop}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 active:scale-95 transition-all"
                >
                  <Square size={14} fill="currentColor" />
                  Stop
                </button>
              </>
            )}
          </div>
        )}

        {/* review state */}
        {step === "review" && (
          <div className="p-5 space-y-4">
            {audioUrlRef.current && (
              <AudioPlayer src={audioUrlRef.current} durationSeconds={durationRef.current} />
            )}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Trash2 size={13} />
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={13} />
                {isSaving ? "Saving…" : "Save recording"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
