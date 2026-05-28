import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import BackButton from "./BackButton";
import { listPatients } from "@/lib/api";
import type { Patient } from "@/lib/types";

export default function PatientHistoryScreen({
  onSelectPatient,
  onBack,
}: {
  onSelectPatient: (id: string, name: string) => void;
  onBack: () => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      listPatients(query || undefined)
        .then(setPatients)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <BackButton onClick={onBack} />
        <h2 className="mb-6">Patient History</h2>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or number"
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : patients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No patients yet</p>
          ) : (
            patients.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPatient(p.id, p.name)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:bg-accent/5 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                  {getInitials(p.name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span>{p.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(p.created_at)}
                    </span>
                  </div>
                  {(p.age || p.gender || p.phone) && (
                    <p className="text-sm text-muted-foreground">
                      {[p.age ? `${p.age}y` : null, p.gender, p.phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
