interface HeartbeatProps {
  level?: number; // 0..1
  size?: number;
}

export default function Heartbeat({ level = 0.3, size = 64 }: HeartbeatProps) {
  const scale = 1 + level * 0.25;
  const opacity = 0.3 + level * 0.5;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* outer ring — pulses independently */}
      <div
        className="absolute rounded-full bg-rose-400 animate-ring-expand"
        style={{ width: size, height: size, opacity: opacity * 0.4 }}
      />
      {/* mid ring */}
      <div
        className="absolute rounded-full bg-rose-400 animate-ring-expand-delayed"
        style={{ width: size * 0.75, height: size * 0.75, opacity: opacity * 0.5 }}
      />
      {/* core dot — scales with mic level */}
      <div
        className="rounded-full bg-rose-500 shadow-lg shadow-rose-300 transition-transform duration-75"
        style={{
          width: size * 0.38,
          height: size * 0.38,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
