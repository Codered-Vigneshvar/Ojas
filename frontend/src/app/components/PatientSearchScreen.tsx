import { Search, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import BackButton from "./BackButton";
import { listPatients, createPatient } from "@/lib/api";
import type { Patient } from "@/lib/types";

export default function PatientSearchScreen({
  onSelectPatient,
  onBack,
}: {
  onSelectPatient: (id: string, name: string) => void;
  onBack: () => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("");
  const [creating, setCreating] = useState(false);
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await createPatient({
        name: newName.trim(),
        phone: newPhone || undefined,
        age: newAge ? parseInt(newAge) : undefined,
        gender: newGender || undefined,
      });
      setShowNewForm(false);
      setNewName(""); setNewPhone(""); setNewAge(""); setNewGender("");
      onSelectPatient(p.id, p.name);
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <BackButton onClick={onBack} />
        <h2 className="mb-6">Select Patient</h2>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or number"
            className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {!showNewForm ? (
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3 hover:bg-accent/5 transition-colors"
          >
            <Plus className="w-5 h-5 text-primary" />
            <span>New Patient</span>
          </button>
        ) : (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">New Patient</span>
              <button onClick={() => setShowNewForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name *"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
                placeholder="Age"
                className="w-1/2 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value)}
                className="w-1/2 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create & Start Session"}
            </button>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm text-muted-foreground mb-3">
            {query ? "Results" : "Recent Patients"}
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : patients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No patients found</p>
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
                  <div className="flex items-baseline gap-2">
                    <span>{p.name}</span>
                    {(p.age || p.gender) && (
                      <span className="text-sm text-muted-foreground">
                        {[p.age ? `${p.age}y` : null, p.gender].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                  {p.phone && (
                    <p className="text-sm text-muted-foreground">{p.phone}</p>
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
