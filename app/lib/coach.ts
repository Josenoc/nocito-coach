export const COACH_NAME = "José Nocito";
export const COACH_EMAIL = "nocito.coach@gmail.com";
export const COACH_PHONE = "+54 9 2616224718";

const COACH_DIGITS = COACH_PHONE.replace(/\D/g, "");

/** Normaliza un teléfono (asume Argentina si no trae código de país). */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0054")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("54")) digits = `54${digits}`;
  return digits;
}

/** Link de WhatsApp con mensaje opcional pre-cargado. */
export function waLink(phone?: string | null, text?: string): string | null {
  if (!phone) return null;
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** WhatsApp del coach, con mensaje opcional. */
export function coachWhatsApp(text?: string): string {
  return `https://wa.me/${COACH_DIGITS}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Link `tel:` del coach para marcar desde el teléfono. */
export const COACH_TEL = `tel:+${COACH_DIGITS}`;

/** Email del coach con asunto opcional pre-cargado. */
export function coachMailto(subject?: string): string {
  return `mailto:${COACH_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
