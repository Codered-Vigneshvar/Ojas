import { Mic, Folder, Sparkles, LogOut } from "lucide-react";
import { useState } from "react";
import { getStoredUsername } from "@/lib/api";

export default function HomeScreen({
  onNewSession,
  onPatientHistory,
  onLogout,
}: {
  onNewSession: () => void;
  onPatientHistory: () => void;
  onLogout: () => void;
}) {
  const [queryExpanded, setQueryExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const username = getStoredUsername();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-foreground capitalize">{username}</span>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center uppercase">
              {username.charAt(0) || "?"}
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent/10 transition-colors text-muted-foreground"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Greeting */}
        <h2 className="mb-8 text-foreground/80">{greeting()}, {username || "Doctor"}</h2>

        {/* Action cards */}
        <div className="space-y-4 mb-8">
          <button
            onClick={onNewSession}
            className="w-full bg-card border border-border rounded-2xl p-6 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <span className="text-lg">New Session</span>
            </div>
          </button>

          <button
            onClick={onPatientHistory}
            className="w-full bg-card border border-border rounded-2xl p-6 text-left hover:bg-accent/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Folder className="w-6 h-6 text-primary" />
              </div>
              <span className="text-lg">Patient History</span>
            </div>
          </button>
        </div>

        {/* Global AI query */}
        <div className="relative">
          {!queryExpanded ? (
            <button
              onClick={() => setQueryExpanded(true)}
              className="w-full bg-card border border-border rounded-xl p-4 text-left flex items-center gap-3 hover:bg-accent/5 transition-colors"
            >
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-foreground/60">Ask anything about your patients...</span>
            </button>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-lg p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1 space-y-4">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-foreground">What did I prescribe Vikram last time?</p>
                  </div>
                  <div>
                    <p className="text-foreground/80 mb-2">
                      You prescribed Amoxicillin 500mg (3x daily for 7 days) for Vikram's tooth infection
                      during his visit on March 18, 2026.
                    </p>
                    <p className="text-xs text-muted-foreground">From session 18 Mar 2026</p>
                    <button className="text-primary text-sm mt-2 hover:underline">
                      Open Vikram's record →
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setQueryExpanded(false);
                    setQuery("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
