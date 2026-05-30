import { useState } from "react";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePatient } from "@/lib/api";
import type { Patient } from "@/types";

interface Props {
  patient: Patient;
  onClose: () => void;
}

export default function EditPatientModal({ patient, onClose }: Props) {
  const [name, setName] = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone_e164);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await updatePatient(patient.id, { name, phone });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      onClose();
    },
    onError: (err: any) => {
      let msg = err.message || "Failed to update patient";
      if (Array.isArray(err.response?.data?.detail)) {
        msg = err.response.data.detail.map((d: any) => d.msg).join(", ");
      } else if (typeof err.response?.data?.detail === "string") {
        msg = err.response.data.detail;
      }
      alert(`Failed to update patient: ${msg}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Edit Patient</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="p-3 mb-6 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl text-xs leading-relaxed">
            <strong>Warning:</strong> Changing a patient's details here will reflect across all their past consultations. Please double-check before saving.
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-neutral-700 block">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all placeholder:text-neutral-400"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-neutral-700 block">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                className="w-full px-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50 transition-all placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-500 font-medium pt-1">
                Must include country code (e.g. +91 for India)
              </p>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !name.trim() || !phone.trim() || (name === patient.name && phone === patient.phone_e164)}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
