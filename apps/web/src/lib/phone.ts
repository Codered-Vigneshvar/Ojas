/** Format an E.164 phone (e.g. "+919820144529") to display form "+91 98201 44529". */
export function formatPhone(e164: string): string {
  const match = e164.match(/^\+91(\d{5})(\d{5})$/);
  if (match) return `+91 ${match[1]} ${match[2]}`;
  return e164;
}

/** Strip display formatting so the API receives a clean string. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return raw.trim();
}
