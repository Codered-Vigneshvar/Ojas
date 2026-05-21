import { useState, useRef } from "react";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  durationSeconds: number;
}

function formatDuration(secs: number): string {
  if (!isFinite(secs) || isNaN(secs)) return "00:00";
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function AudioPlayer({ src, durationSeconds }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Throttle timeupdate to avoid excessive re-renders
  const lastUpdateRef = useRef(0);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const now = performance.now();
    if (now - lastUpdateRef.current > 100) {
      setCurrentTime(audioRef.current.currentTime);
      lastUpdateRef.current = now;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Keep duration strictly finite, even if audio.duration says Infinity
  const safeDuration = isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 1;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      <button
        onClick={togglePlay}
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-neutral-900 text-white rounded-full hover:bg-neutral-800 transition-colors"
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>

      <span className="text-xs font-mono text-neutral-500 tabular-nums">
        {formatDuration(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={safeDuration}
        step={0.01}
        value={currentTime}
        onChange={handleScrub}
        className="flex-1 h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer accent-neutral-900"
      />

      <span className="text-xs font-mono text-neutral-500 tabular-nums">
        {formatDuration(safeDuration)}
      </span>
    </div>
  );
}
