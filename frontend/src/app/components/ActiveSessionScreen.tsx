import { Mic, Square, FileText, Upload, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import BackButton from "./BackButton";
import {
  createSession,
  transcribeFullAudio,
  patchSession,
  structurePrescription,
} from "@/lib/api";

type Stage = "idle" | "recording" | "transcribing" | "stopped";
type Tab = "record" | "notes" | "prescription";

export default function ActiveSessionScreen({
  patientId,
  patientName,
  onSaveClose,
  onBack,
}: {
  patientId: string;
  patientName: string;
  onSaveClose: () => void;
  onBack: () => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("record");
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [rxState, setRxState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("audio/webm");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    createSession(patientId)
      .then((r) => setSessionId(r.session_id))
      .catch(() => setError("Failed to create session. Is the backend running?"));
  }, [patientId]);

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (!sessionId) return;
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(4000);
      recorderRef.current = recorder;
      setStage("recording");
    } catch {
      setError("Microphone access denied or recording failed.");
    }
  };

  const stopRecording = async () => {
    if (!sessionId || !recorderRef.current) return;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorder.stream.getTracks().forEach((t) => t.stop());
    setStage("transcribing");

    try {
      const fullBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      const result = await transcribeFullAudio(sessionId, fullBlob, mimeTypeRef.current);
      setTranscript(result.raw_transcript || "");
    } catch {
      setError("Failed to transcribe audio. Check your Deepgram API key.");
    } finally {
      setStage("stopped");
    }
  };

  // ── Prescription ───────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setRxState("uploading");
    try {
      await structurePrescription(sessionId, file);
      setRxState("done");
    } catch {
      setRxState("error");
    }
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSaveClose = async () => {
    if (!sessionId) return;
    // Save doctor notes if any were typed
    if (notes.trim()) {
      try {
        await patchSession(sessionId, { doctor_notes: notes.trim() });
      } catch {
        // Non-fatal
      }
    }
    onSaveClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "record", label: "Record", icon: <Mic className="w-4 h-4" /> },
    { key: "notes", label: "Notes", icon: <FileText className="w-4 h-4" /> },
    { key: "prescription", label: "Rx Upload", icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col min-h-screen">
        <BackButton onClick={onBack} />

        <div className="mb-4">
          <h2>{patientName}</h2>
          {sessionId ? (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Session {sessionId.slice(0, 8)}...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Starting session...</p>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/30 rounded-xl p-1 mb-4">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-colors ${
                activeTab === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1">

          {/* ── Record tab ── */}
          {activeTab === "record" && (
            <div className="space-y-4">
              {/* Mic / Stop button */}
              <div className="flex justify-center">
                {stage === "recording" ? (
                  <button
                    onClick={stopRecording}
                    className="w-24 h-24 rounded-full bg-destructive text-destructive-foreground flex flex-col items-center justify-center gap-1 animate-pulse shadow-lg"
                  >
                    <Square className="w-8 h-8" />
                    <span className="text-xs">Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={!sessionId || stage === "transcribing"}
                    className="w-24 h-24 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center gap-1 hover:opacity-90 disabled:opacity-40 transition-opacity shadow-lg"
                  >
                    <Mic className="w-8 h-8" />
                    <span className="text-xs">
                      {stage === "stopped" ? "Re-record" : "Record"}
                    </span>
                  </button>
                )}
              </div>

              {/* Transcript / status */}
              <div className="bg-card border border-border rounded-xl p-4 min-h-[220px]">
                <p className="text-xs text-muted-foreground mb-2">
                  {stage === "recording"
                    ? "Listening..."
                    : stage === "transcribing"
                    ? "Processing audio..."
                    : "Transcript"}
                </p>
                {transcript ? (
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    {stage === "recording"
                      ? "Recording in progress..."
                      : stage === "transcribing"
                      ? "Converting speech to text, you can switch tabs..."
                      : "Tap Record to start."}
                  </p>
                )}
                {stage === "recording" && <span className="animate-pulse text-primary">▊</span>}
              </div>

              {stage === "stopped" && transcript && (
                <p className="text-center text-xs text-muted-foreground">
                  AI note will be ready when you reopen this session.
                </p>
              )}
            </div>
          )}

          {/* ── Notes tab ── */}
          {activeTab === "notes" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Freeform notes — saved as transcript if no recording was made.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Chief complaint, clinical findings, anything you want to note during the session..."
                rows={12}
                className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}

          {/* ── Prescription tab ── */}
          {activeTab === "prescription" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Upload a photo of the prescription — OCR will extract and structure it automatically.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {rxState === "idle" && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!sessionId}
                  className="w-full border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Tap to upload or take a photo</span>
                </button>
              )}

              {rxState === "uploading" && (
                <div className="w-full border border-border rounded-xl py-12 flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm">Reading prescription...</span>
                </div>
              )}

              {rxState === "done" && (
                <div className="w-full bg-primary/5 border border-primary/20 rounded-xl py-8 flex flex-col items-center gap-3">
                  <Check className="w-8 h-8 text-primary" />
                  <span className="text-sm text-primary">Prescription saved successfully.</span>
                  <button
                    onClick={() => {
                      setRxState("idle");
                      fileInputRef.current?.click();
                    }}
                    className="text-xs text-muted-foreground underline"
                  >
                    Upload another
                  </button>
                </div>
              )}

              {rxState === "error" && (
                <div className="w-full bg-destructive/5 border border-destructive/20 rounded-xl py-8 flex flex-col items-center gap-3">
                  <span className="text-sm text-destructive">Upload failed. Try again.</span>
                  <button
                    onClick={() => setRxState("idle")}
                    className="text-xs text-muted-foreground underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer status + save */}
        <div className="pt-4 mt-4 border-t border-border">
          {stage === "transcribing" && (
            <p className="text-center text-xs text-muted-foreground mb-3 animate-pulse">
              Transcribing audio in background — feel free to add notes or upload a prescription.
            </p>
          )}
          <button
            onClick={handleSaveClose}
            disabled={!sessionId}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
