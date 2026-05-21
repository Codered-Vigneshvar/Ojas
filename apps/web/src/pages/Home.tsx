import { useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Users, ChevronRight } from "lucide-react";
import { listPatients } from "@/lib/api";
import PatientRow from "@/components/PatientRow";
import CreatePatientModal from "@/components/CreatePatientModal";
import { greeting } from "@/lib/time";

export default function Home() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: deferredSearch ? ["patients", "search", deferredSearch] : ["patients", "recent"],
    queryFn: () => listPatients(deferredSearch || undefined),
    staleTime: 15_000,
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* top bar */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-neutral-900 text-base tracking-tight">Ojas</span>
            <span className="px-2 py-0.5 rounded-md border border-neutral-200 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Clinic
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors font-mono">
              <span className="text-[10px]">⌘K</span>
              <span>Quick search</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xs font-semibold select-none">
              DR
            </div>
          </div>
        </div>
      </header>

      {/* main */}
      <main className="max-w-3xl mx-auto px-6 pt-12 pb-20 animate-fade-in">
        {/* greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
            {greeting()}, Dr Sreekanth.
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Open a patient. Drop in anything. Ask the AI.
          </p>
        </div>

        {/* search + create */}
        <div className="flex gap-3 mb-8">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient by name or phone number"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-neutral-400 transition-colors placeholder:text-neutral-400 shadow-sm"
              autoComplete="off"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 active:scale-95 transition-all shadow-sm whitespace-nowrap"
          >
            <Plus size={15} />
            Create new patient
          </button>
        </div>

        {/* recent patients */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-700">
                {deferredSearch ? "Search results" : "Recent patients"}
              </h2>
              {patients.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-xs font-mono text-neutral-500">
                  {patients.length}
                </span>
              )}
            </div>
            {!deferredSearch && (
              <button className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors font-mono">
                All patients
                <ChevronRight size={12} />
              </button>
            )}
          </div>

          {isLoading && (
            <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0 border-neutral-50">
                  <div className="w-10 h-10 rounded-full animate-shimmer flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-36 rounded animate-shimmer" />
                    <div className="h-2.5 w-24 rounded animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && patients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-neutral-100 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
                <Users size={22} className="text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700">
                {deferredSearch ? "No patients found" : "No patients yet"}
              </p>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                {deferredSearch
                  ? `No results for "${deferredSearch}"`
                  : "Create your first patient to get started"}
              </p>
              {!deferredSearch && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <Plus size={13} />
                  Create patient
                </button>
              )}
            </div>
          )}

          {!isLoading && patients.length > 0 && (
            <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm divide-y divide-neutral-50 stagger-children">
              {patients.map((p) => (
                <div key={p.id} className="animate-fade-in">
                  <PatientRow patient={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreate && <CreatePatientModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
