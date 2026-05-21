import { useRef, useState, useEffect, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { X, UserPlus, Phone, User } from "lucide-react";
import { createPatient } from "@/lib/api";
import type { AxiosError } from "axios";
import type { ApiError } from "@/lib/api";

interface Props {
  onClose: () => void;
}

export default function CreatePatientModal({ onClose }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () => createPatient(name.trim(), phone.trim()),
    onSuccess: (patient) => {
      qc.invalidateQueries({ queryKey: ["patients", "recent"] });
      navigate(`/p/${patient.id}`);
    },
    onError: (err: AxiosError<ApiError>) => {
      const detail = err.response?.data?.detail ?? "Something went wrong";
      setFieldError(detail);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFieldError("Name is required"); return; }
    if (!phone.trim()) { setFieldError("Phone number is required"); return; }
    setFieldError(null);
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 p-8 animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-neutral-900">
            <UserPlus size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 text-lg leading-tight">New patient</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Opens the workspace immediately after saving</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Full name</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aanya Sharma"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white focus:border-neutral-400 focus:outline-none transition-colors placeholder:text-neutral-400"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98201 44529"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-neutral-50 focus:bg-white focus:border-neutral-400 focus:outline-none transition-colors placeholder:text-neutral-400 font-mono"
                autoComplete="tel"
              />
            </div>
            <p className="text-xs text-neutral-400 mt-1">Indian number — 10 digits or +91 format</p>
          </div>

          {(fieldError || mutation.isError) && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {fieldError ?? "An unexpected error occurred"}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? "Creating…" : "Create patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
