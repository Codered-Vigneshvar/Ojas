import { Search, Hash, MessageSquare } from "lucide-react";
import type { Artifact } from "@/types";
import SnippetCard from "./SnippetCard";

interface Props {
  snippets: Artifact[];
  activeSnippetId: string | null;
  onSelectSnippet: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  readSnippets: Set<string>;
}

export default function SnippetSidebar({
  snippets,
  activeSnippetId,
  onSelectSnippet,
  searchQuery,
  onSearchChange,
  readSnippets,
}: Props) {
  return (
    <div className="w-80 border-r border-neutral-200 bg-white flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Header & Search */}
      <div className="p-4 border-b border-neutral-100 flex-shrink-0 space-y-4">
        <div className="flex items-center gap-2 text-neutral-800">
          <Hash size={18} className="text-teal-600" />
          <h2 className="font-bold text-sm">Consultation Snippets</h2>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes, transcripts..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5 transition-all placeholder:text-neutral-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Snippets List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
        {snippets.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mb-3">
              <MessageSquare size={20} className="text-neutral-300" />
            </div>
            <p className="text-sm font-medium text-neutral-600">No snippets found</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">
              {searchQuery
                ? "Try adjusting your search query"
                : "Record audio, write a note, or upload a file to add a snippet."}
            </p>
          </div>
        ) : (
          <div className="stagger-children">
            {snippets.map((snippet) => (
              <div key={snippet.id} className="animate-fade-in">
                <SnippetCard
                  snippet={snippet}
                  isActive={activeSnippetId === snippet.id}
                  isRead={readSnippets.has(snippet.id)}
                  onClick={() => {
                    // Toggle off if already active, else set active
                    onSelectSnippet(activeSnippetId === snippet.id ? null : snippet.id);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
