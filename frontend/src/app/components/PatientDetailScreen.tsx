import { Sparkles, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import BackButton from "./BackButton";
import { listPatientSessions } from "@/lib/api";
import type { SessionListItem } from "@/lib/types";

export default function PatientDetailScreen({
  patientId,
  patientName,
  onSelectSession,
  onBack,
}: {
  patientId: string;
  patientName: string;
  onSelectSession: (sessionId: string) => void;
  onBack: () => void;
}) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryExpanded, setQueryExpanded] = useState(false);

  useEffect(() => {
    listPatientSessions(patientId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [patientId]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const sessionBadges = (s: SessionListItem) => {
    const badges: string[] = [];
    if (s.has_transcript) badges.push("Transcript");
    if (s.has_note) badges.push("Note");
    if (s.has_prescription) badges.push("Prescription");
    return badges;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <BackButton onClick={onBack} />

        <div className="mb-6">
          <h2>{patientName}</h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            {patientId.slice(0, 8)}...
          </p>
        </div>

        {/* AI summary — placeholder for Demo 1 */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground/70 italic">
              AI patient summary will appear here after the first structured session.
            </p>
          </div>
        </div>

        {/* Patient-level AI query — UI placeholder for Demo 1 */}
        <div className="mb-6">
          {!queryExpanded ? (
            <button
              onClick={() => setQueryExpanded(true)}
              className="w-full bg-card border border-border rounded-xl p-4 text-left flex items-center gap-3 hover:bg-accent/5 transition-colors"
            >
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-foreground/60">Ask about this patient...</span>
            </button>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground italic">
                    Patient-level AI query coming soon.
                  </p>
                </div>
                <button
                  onClick={() => setQueryExpanded(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Session timeline */}
        <div className="space-y-2">
          <h3 className="text-sm text-muted-foreground mb-3">Sessions</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No sessions yet. Start a new session to begin.
            </p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.session_id}
                onClick={() => onSelectSession(s.session_id)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-accent/5 transition-colors text-left"
              >
                <div>
                  <p className="mb-2">{formatDate(s.created_at)}</p>
                  <div className="flex gap-2 flex-wrap">
                    {sessionBadges(s).map((badge) => (
                      <span
                        key={badge}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ))}
                    {s.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
