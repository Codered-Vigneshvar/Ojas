import { useState, useRef, useEffect, type FormEvent } from "react";
import { X, StickyNote } from "lucide-react";

interface Props {
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

export default function NoteModal({ onSave, onClose, isSaving }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const firstLine = text.trim().split("\n")[0]?.slice(0, 80) || "Untitled note";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSave(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 animate-slide-up overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <StickyNote size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800 leading-tight truncate max-w-xs">
                {firstLine}
              </p>
              <p className="text-xs text-neutral-400">New note</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* textarea */}
        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"First line becomes the title…\n\nType your note here. Plain text, no formatting needed."}
            className="w-full px-5 py-4 text-sm leading-relaxed text-neutral-800 placeholder:text-neutral-300 focus:outline-none resize-none font-mono"
            style={{ minHeight: "260px" }}
          />

          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
            <p className="text-xs text-neutral-400 font-mono">
              {text.length > 0 ? `${text.split("\n").length} line${text.split("\n").length !== 1 ? "s" : ""}` : "Start typing…"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={!text.trim() || isSaving}
                className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Saving…" : "Save note"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
