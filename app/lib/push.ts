import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:nocito.coach@gmail.com";
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    return false;
  }
}

export type PushSubscriptionJson = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

/**
 * Envía una notificación push a todos los dispositivos suscritos del coach.
 * La suscripción se guarda en el jsonb `anamnesis` del perfil del coach bajo
 * la clave `pushSubscriptions` (sin cambios de esquema).
 */
export async function sendCoachPush(
  payload: PushPayload
): Promise<{ ok: boolean; sent?: number; error?: string }> {
  if (!configure()) return { ok: false, error: "VAPID no configurado" };

  const supabase = getSupabaseAdmin();
  const { data: coach, error } = await supabase
    .from("profiles")
    .select("id, anamnesis")
    .eq("role", "coach")
    .limit(1)
    .maybeSingle();
  if (error || !coach) return { ok: false, error: error?.message || "Coach no encontrado" };

  const anamnesis = (coach.anamnesis as Record<string, unknown>) ?? {};
  const subs = Array.isArray(anamnesis.pushSubscriptions)
    ? (anamnesis.pushSubscriptions as PushSubscriptionJson[])
    : [];
  if (subs.length === 0) return { ok: true, sent: 0 };

  const body = JSON.stringify(payload);
  const alive: PushSubscriptionJson[] = [];
  let sent = 0;
  let changed = false;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub as any, body);
        alive.push(sub);
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          changed = true;
        } else {
          alive.push(sub);
        }
      }
    })
  );

  if (changed) {
    await supabase
      .from("profiles")
      .update({ anamnesis: { ...anamnesis, pushSubscriptions: alive } })
      .eq("id", coach.id);
  }

  return { ok: true, sent };
}

export function getVapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}
