/**
 * Utilidades Base64 robustas.
 *
 * `atob` es frágil: falla si la cadena tiene espacios/saltos de línea, si le
 * falta el padding, o si viene en alfabeto URL-safe (`-` / `_`) — cosas muy
 * comunes al copiar/pegar claves VAPID. Estas funciones normalizan la entrada y
 * nunca dejan escapar una excepción críptica.
 */

/** Decodifica Base64 (estándar o URL-safe) a un Uint8Array. */
export function base64ToUint8Array(input: string): Uint8Array {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("Base64 vacío o inválido");
  }
  const clean = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!clean) throw new Error("Base64 vacío o inválido");
  const pad = clean.length % 4;
  const padded = pad === 0 ? clean : clean + "=".repeat(4 - pad);
  let raw: string;
  try {
    raw = atob(padded);
  } catch {
    throw new Error("Base64 inválido: no se pudo decodificar");
  }
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/** Versión segura: devuelve `null` en lugar de lanzar si la entrada es inválida. */
export function safeBase64ToUint8Array(input: string): Uint8Array | null {
  try {
    return base64ToUint8Array(input);
  } catch {
    return null;
  }
}

/**
 * Alias pensado para la Web Push API: convierte una clave pública VAPID
 * (`applicationServerKey`) a Uint8Array de forma segura.
 */
export const urlBase64ToUint8Array = base64ToUint8Array;

/**
 * Decodifica Base64 (estándar o URL-safe) a texto de forma segura: normaliza
 * espacios/alfabeto y devuelve `null` en lugar de lanzar si algo falla.
 */
export function safeAtob(input: string): string | null {
  try {
    const clean = String(input ?? "")
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (!clean) return null;
    const pad = clean.length % 4;
    const padded = pad === 0 ? clean : clean + "=".repeat(4 - pad);
    return atob(padded);
  } catch {
    return null;
  }
}
