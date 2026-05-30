import { useState, useRef, useEffect } from "react";
import { X, Square, Pause, Play, Loader2 } from "lucide-react";
import { useRecorder } from "@/hooks/useRecorder";
import Heartbeat from "@/components/Heartbeat";
import type { Artifact } from "@/types";

interface Props {
  onSave: (blob: Blob, durationSeconds: number) => Promise<Artifact>;
  onClose: () => void;
  onStopInitiated?: (durationSeconds: number) => void;
}

type Step = "recording" | "paused" | "saving";

export default function RecordModal({ onSave, onClose, onStopInitiated }: Props) {
  const recorder = useRecorder();
  const [step, setStep] = useState<Step>("recording");
  const durationRef = useRef(0);

  // Guard: ensure onSave is only called once per session even if effect re-runs
  const uploadStartedRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    recorder.start();
    return () => {
      recorder.reset();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recorder.state === "stopping" && recorder.audioBlob && step === "saving") {
      if (uploadStartedRef.current) return;
      uploadStartedRef.current = true;

      onSaveRef.current(recorder.audioBlob, durationRef.current).catch((err) => {
        console.error("Error saving audio artifact:", err);
        onCloseRef.current();
      });
    }
  }, [recorder.state, recorder.audioBlob, step]);

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "saving") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  const handlePause = () => { recorder.pause(); setStep("paused"); };
  const handleResume = () => { recorder.resume(); setStep("recording"); };

  const handleStop = () => {
    durationRef.current = recorder.durationSeconds;
    setStep("saving");
    if (onStopInitiated) onStopInitiated(durationRef.current);
    recorder.stop();
  };

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4 ${step === "saving" ? "hidden" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== "saving") onClose();
      }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up flex flex-col transition-all duration-300 ease-out w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-neutral-900">
                {step === "recording" && "Recording Consultation"}
                {step === "paused" && "Recording Paused"}
                {step === "saving" && "Saving Audio..."}
              </h2>
            </div>
          </div>
          {step !== "saving" && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* ── RECORDING / PAUSED / SAVING ── */}
        <div className="px-5 py-8 flex flex-col items-center flex-1 justify-center">
          <div className="relative w-24 h-24 flex items-center justify-center mb-6">
            <div className={`absolute inset-0 bg-red-100 rounded-full ${step === "recording" ? "animate-ping opacity-75" : "opacity-0"}`} />
            <div className={`absolute w-16 h-16 rounded-full flex items-center justify-center transition-colors ${step === "recording" ? "bg-red-500 shadow-lg shadow-red-500/30" : "bg-neutral-200"}`}>
              {step === "recording" && (
                <div aria-live="polite" aria-label="Recording in progress" className="mt-2">
                  <Heartbeat level={recorder.levelNormalized} size={80} />
                </div>
              )}
              {step === "paused" && <Pause size={24} className="text-neutral-500" fill="currentColor" />}
              {step === "saving" && <Loader2 size={24} className="text-neutral-500 animate-spin" />}
            </div>
          </div>

          <div className="text-4xl font-mono tracking-tight text-neutral-800 font-medium mb-10 tabular-nums">
            {new Date((step === "saving" ? durationRef.current : recorder.durationSeconds) * 1000).toISOString().substring(14, 19)}
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            {step === "saving" ? (
              <div className="flex items-center justify-center w-full py-2.5 text-xs font-medium text-neutral-500">
                Processing and saving...
              </div>
            ) : (
              <>
                {step === "recording" ? (
                  <button onClick={handlePause} className="flex items-center gap-2 flex-1 justify-center py-2.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                    <Pause size={13} fill="currentColor" /> Pause
                  </button>
                ) : (
                  <button onClick={handleResume} className="flex items-center gap-2 flex-1 justify-center py-2.5 text-xs font-medium text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors">
                    <Play size={13} fill="currentColor" /> Resume
                  </button>
                )}
                <button onClick={handleStop} className="flex items-center gap-2 flex-1 justify-center py-2.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors">
                  <Square size={13} fill="currentColor" /> Stop & Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
