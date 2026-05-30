import { useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search, CalendarPlus, Plus, User } from "lucide-react";
import { listPatients, createPatient, createAppointment, listAppointments, patchAppointment } from "@/lib/api";
import type { Patient, Appointment } from "@/types";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  selectedDate: Date;
  initialTimeStr?: string;
  editAppointment?: Appointment | null;
}

export default function BookAppointmentModal({ onClose, onSuccess, selectedDate, initialTimeStr = "09:00", editAppointment }: Props) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(() => {
    if (editAppointment) {
      return { id: editAppointment.patient_id, name: editAppointment.patient_name, phone_e164: "" } as Patient;
    }
    return null;
  });

  // New patient state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Appointment state
  const [apptDateStr, setApptDateStr] = useState(() => {
    if (editAppointment) {
      const d = new Date(editAppointment.scheduled_time);
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    const d = selectedDate;
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  const [startHour, setStartHour] = useState(() => {
    if (editAppointment) return new Date(editAppointment.scheduled_time).getHours().toString();
    return parseInt(initialTimeStr.split(":")[0], 10).toString();
  });
  const [startMin, setStartMin] = useState(() => {
    if (editAppointment) {
      const mins = new Date(editAppointment.scheduled_time).getMinutes();
      const closest = [0, 15, 30, 45].reduce((prev, curr) => 
        Math.abs(curr - mins) < Math.abs(prev - mins) ? curr : prev
      );
      return closest.toString().padStart(2, '0');
    }
    return initialTimeStr.split(":")[1];
  });

  const [durationHours, setDurationHours] = useState(() => {
    if (editAppointment) return Math.floor(editAppointment.duration_minutes / 60).toString();
    return "0";
  });
  const [durationMins, setDurationMins] = useState(() => {
    if (editAppointment) return (editAppointment.duration_minutes % 60).toString();
    return "15";
  });

  const [notes, setNotes] = useState(editAppointment?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch appointments for the selected date to check conflicts
  const { data: dayAppointments = [] } = useQuery({
    queryKey: ["appointments", apptDateStr],
    queryFn: () => listAppointments(apptDateStr),
    staleTime: 10_000,
  });

  const hasConflict = () => {
    const newStart = parseInt(startHour) * 60 + parseInt(startMin);
    const newEnd = newStart + parseInt(durationHours) * 60 + parseInt(durationMins);

    return dayAppointments.some((appt: Appointment) => {
      if (editAppointment && appt.id === editAppointment.id) return false;
      const apptD = new Date(appt.scheduled_time);
      const start = apptD.getHours() * 60 + apptD.getMinutes();
      const end = start + appt.duration_minutes;
      return newStart < end && newEnd > start;
    });
  };

  const { data: patients = [], isLoading: isSearching } = useQuery({
    queryKey: deferredSearch ? ["patients", "search", deferredSearch] : ["patients", "recent"],
    queryFn: () => listPatients(deferredSearch || undefined),
    staleTime: 15_000,
    enabled: !selectedPatient && !isCreatingNew,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      let targetPatientId = selectedPatient?.id;

      if (isCreatingNew) {
        if (!newName.trim() || !newPhone.trim()) return;
        const newP = await createPatient(newName.trim(), newPhone.trim());
        targetPatientId = newP.id;
      }

      if (!targetPatientId) return;

      // Construct Date object combining apptDateStr and timeStr
      const apptDate = new Date(apptDateStr);
      apptDate.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
      const totalMins = parseInt(durationHours) * 60 + parseInt(durationMins);

      if (editAppointment) {
        const updatePayload: any = {
          scheduled_time: apptDate.toISOString(),
          duration_minutes: totalMins,
          notes: notes.trim() || undefined,
        };

        if (editAppointment.status === "cancelled") {
          updatePayload.status = "scheduled";
        }

        await patchAppointment(editAppointment.id, updatePayload);
      } else {
        await createAppointment({
          patient_id: targetPatientId,
          scheduled_time: apptDate.toISOString(),
          duration_minutes: totalMins,
          notes: notes.trim() || undefined,
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Unknown error";
      if (Array.isArray(err.response?.data?.detail)) {
        msg = err.response.data.detail.map((d: any) => d.msg).join(", ");
      } else if (typeof err.response?.data?.detail === "string") {
        msg = err.response.data.detail;
      }
      alert(`Failed to save appointment: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-900">
            <CalendarPlus size={18} className="text-teal-600" />
            <h2 className="font-semibold text-lg">{editAppointment ? "Edit Appointment" : "Book Appointment"}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Patient Selection Phase */}
          {!selectedPatient && !isCreatingNew ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-700">Select Patient</label>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-neutral-200 rounded-xl bg-neutral-50 focus:bg-white focus:outline-none focus:border-teal-500 transition-colors"
                  autoFocus
                />
              </div>

              <div className="max-h-60 overflow-y-auto border border-neutral-100 rounded-xl divide-y divide-neutral-50">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-neutral-500">Searching...</div>
                ) : patients.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-neutral-500 mb-3">No patients found.</p>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(true)}
                      className="text-sm font-medium text-teal-600 hover:text-teal-700 underline underline-offset-4"
                    >
                      Create new patient instead
                    </button>
                  </div>
                ) : (
                  patients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className="w-full text-left p-3 hover:bg-neutral-50 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <div className="font-medium text-neutral-900 text-sm group-hover:text-teal-700 transition-colors">
                          {p.name}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">{p.phone_e164}</div>
                      </div>
                      <Plus size={16} className="text-neutral-300 group-hover:text-teal-500" />
                    </button>
                  ))
                )}
              </div>

              {patients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full py-2.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 hover:text-neutral-900 transition-colors flex items-center justify-center gap-2"
                >
                  <User size={16} />
                  New Patient
                </button>
              )}
            </div>
          ) : (
            /* Appointment Details Phase */
            <form id="book-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Selected / New Patient Display */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">
                    {isCreatingNew ? "New Patient" : "Selected Patient"}
                  </div>
                  {isCreatingNew ? (
                    <div className="space-y-2 mt-2">
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="tel"
                        required
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="Phone Number (+91...)"
                        className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  ) : (
                    <div className="font-medium text-neutral-900">{selectedPatient?.name}</div>
                  )}
                </div>
                {!isCreatingNew && (
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-700 underline"
                  >
                    Change
                  </button>
                )}
                {isCreatingNew && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="text-xs text-neutral-400 hover:text-neutral-700 self-start"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Date, Time & Duration */}
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">Date</label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={apptDateStr}
                        onChange={(e) => setApptDateStr(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors bg-white text-neutral-700 font-mono accent-teal-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">Start Time</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                        className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-teal-500 transition-colors"
                      >
                        {Array.from({ length: 24 }).map((_, i) => (
                          <option key={i} value={i.toString()}>
                            {i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`}
                          </option>
                        ))}
                      </select>
                      <span className="text-neutral-400 font-bold">:</span>
                      <select
                        value={startMin}
                        onChange={(e) => setStartMin(e.target.value)}
                        className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-teal-500 transition-colors"
                      >
                        {['00', '15', '30', '45'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-neutral-700">Duration</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-teal-500 transition-colors"
                    >
                      {Array.from({ length: 9 }).map((_, i) => (
                        <option key={i} value={i.toString()}>{i} hr{i !== 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    <select
                      value={durationMins}
                      onChange={(e) => setDurationMins(e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-teal-500 transition-colors"
                    >
                      {['0', '15', '30', '45'].map(m => (
                        <option key={m} value={m}>{m} mins</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {hasConflict() && (
                <div className="p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl text-xs font-medium leading-relaxed mt-2 flex items-start gap-2">
                  <span className="text-yellow-600">⚠️</span>
                  Warning: The selected time overlaps with an existing appointment. You can still create it if you wish.
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-neutral-700">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for visit..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-teal-500 transition-colors resize-none"
                />
              </div>
            </form>
          )}
        </div>

        <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="book-form"
            disabled={(!selectedPatient && !isCreatingNew) || isSubmitting || (parseInt(durationHours) === 0 && parseInt(durationMins) === 0)}
            className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-[0.98] flex items-center justify-center min-w-[140px]"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              editAppointment ? "Save Changes" : "Confirm Appointment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
