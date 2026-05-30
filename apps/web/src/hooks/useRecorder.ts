import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState =
  | "idle"
  | "requesting_mic"
  | "recording"
  | "paused"
  | "stopping"
  | "error";

interface UseRecorderResult {
  state: RecorderState;
  durationSeconds: number;
  levelNormalized: number; // 0..1 — mic loudness for heartbeat
  audioBlob: Blob | null;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getPartialBlob: () => Blob | null;
  reset: () => void;
}

export function useRecorder(): UseRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [levelNormalized, setLevelNormalized] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setLevelNormalized(0);
  }, []);

  const startAnalyser = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      setLevelNormalized(Math.min(1, rms / 80));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    setState("requesting_mic");
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        // Duration is tracked by the live timer — no need for slow decodeAudioData.
        setState("stopping");
      };

      mr.start();
      startAnalyser(stream);
      setState("recording");
      setDurationSeconds(0);

      timerRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setErrorMessage(
        "Microphone permission denied — please enable it in browser settings and try again.",
      );
      setState("error");
    }
  }, [startAnalyser]);

  const pause = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") return;
    // requestData() fires ondataavailable with all chunks accumulated so far
    mr.requestData();
    mr.pause();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAnalyser();
    setState("paused");
  }, [stopAnalyser]);

  const resume = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "paused") return;
    mr.resume();
    if (streamRef.current) startAnalyser(streamRef.current);
    setState("recording");
    timerRef.current = setInterval(() => setDurationSeconds((s) => s + 1), 1000);
  }, [startAnalyser]);

  const getPartialBlob = useCallback((): Blob | null => {
    if (chunksRef.current.length === 0) return null;
    const mimeType = mediaRecorderRef.current?.mimeType ?? "audio/webm";
    return new Blob(chunksRef.current, { type: mimeType });
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAnalyser();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
  }, [stopAnalyser]);

  const reset = useCallback(() => {
    stop();
    setAudioBlob(null);
    setDurationSeconds(0);
    setLevelNormalized(0);
    setErrorMessage(null);
    chunksRef.current = [];
    setState("idle");
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAnalyser();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [stopAnalyser]);

  return {
    state,
    durationSeconds,
    levelNormalized,
    audioBlob,
    errorMessage,
    start,
    stop,
    pause,
    resume,
    getPartialBlob,
    reset,
  };
}
