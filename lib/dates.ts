// Utilidades de fecha del negocio.
// Todo nocito.coach opera en horario de Argentina (America/Argentina/Mendoza).
// IMPORTANTE: toISOString().slice(0,10) devuelve la fecha en UTC; después de
// las 21:00 (hora argentina) ya devuelve el día siguiente y las series quedan
// guardadas en la fecha equivocada (y el coach no las ve en "hoy").

export function todayInArgentina(now: Date = new Date()): string {
  try {
    // en-CA produce YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Mendoza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // Fallback: Argentina = UTC-3 (sin DST).
    const local = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, "0");
    const d = String(local.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

export function isValidISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
