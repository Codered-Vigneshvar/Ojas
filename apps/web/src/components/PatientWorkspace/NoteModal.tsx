import { useState, useRef, useEffect } from "react";
import { X, StickyNote, Plus, Loader2 } from "lucide-react";

interface Props {
  onSave: (text: string, description: string) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

export default function NoteModal({ onSave, onClose, isSaving }: Props) {
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isSaving]);

  const handleSave = () => {
    if (!text.trim() || isSaving) return;
    onSave(text, description);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up flex flex-col transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <StickyNote size={14} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 leading-tight">Write Quick Note</h2>
            </div>
          </div>
          {!isSaving && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Form Body */}
        <div className="p-5 flex flex-col gap-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              placeholder="Type your clinical note here... Press Enter to save, Shift + Enter for new line."
              className="w-full text-sm leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:outline-none resize-none bg-neutral-50/35 p-4 border border-neutral-200 rounded-xl focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 transition-all font-sans"
              style={{ minHeight: "180px" }}
            />
          </div>

          {/* Description Section */}
          {showDescription ? (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block ml-1">
                Description / Snippet Label
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isSaving}
                placeholder="a short snippet information to be added"
                className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 transition-all shadow-sm hover:shadow"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 border border-dashed border-neutral-300 rounded-lg w-fit transition-all ml-1 disabled:opacity-40"
            >
              <Plus size={13} />
              Add Description
            </button>
          )}
        </div>

        {/* Footer Info (No buttons as requested) */}
        <div className="px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/50 flex justify-between items-center text-xs text-neutral-400 flex-shrink-0">
          <p className="font-mono">
            {text.length > 0
              ? `${text.split("\n").length} line${text.split("\n").length !== 1 ? "s" : ""}`
              : "Start typing..."}
          </p>
          <div className="flex items-center gap-1.5">
            {isSaving ? (
              <div className="flex items-center gap-1.5 font-medium text-teal-700">
                <Loader2 size={13} className="animate-spin text-teal-600" />
                <span>Saving note...</span>
              </div>
            ) : (
              <span className="flex items-center gap-1">
                Press 
                <kbd className="bg-neutral-200/80 px-1 py-0.5 rounded font-mono text-[10px] text-neutral-600 font-bold border border-neutral-300/40">
                  Enter
                </kbd> 
                to save
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
