import { useState, useRef, useEffect } from "react";
import { X, FileUp, Loader2 } from "lucide-react";

interface Props {
  onSave: (file: File) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

export default function UploadModal({ onSave, onClose, isSaving }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isSaving]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await onSave(file);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await onSave(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up flex flex-col transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
              <FileUp size={14} className="text-teal-600" />
            </div>
            <h2 className="font-semibold text-neutral-900">Upload Documents</h2>
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
        <div className="p-6 flex flex-col items-center justify-center">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleChange}
            disabled={isSaving}
            accept="*/*"
          />

          {isSaving ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center animate-fade-in w-full">
              <Loader2 size={32} className="animate-spin text-teal-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-800">Uploading Document...</p>
                <p className="text-xs text-neutral-400 mt-1">AI is analyzing and labeling your file details</p>
              </div>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={handleClick}
              className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all duration-300 group ${
                isDragging
                  ? "border-teal-500 bg-teal-50/50 shadow-inner"
                  : "border-neutral-200 hover:border-neutral-400 bg-neutral-50/50 hover:bg-neutral-50"
              }`}
            >
              <div className={`p-4 rounded-full mb-4 transition-transform group-hover:scale-110 duration-300 ${
                isDragging ? "bg-teal-100 text-teal-600 animate-bounce" : "bg-neutral-100 text-neutral-500"
              }`}>
                <FileUp size={24} />
              </div>

              <p className="text-sm text-neutral-600 leading-relaxed font-medium mb-1">
                Drag & drop your files here, or
              </p>
              <p className="text-sm text-teal-600 group-hover:text-teal-700 font-semibold underline mb-4">
                browse files in your system
              </p>
              
              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-[240px]">
                Supports medical reports, laboratory results, prescriptions, and images.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
