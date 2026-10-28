import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { generatePersonalizedPush } from "@/lib/push-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function argentinaNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
}

function isFriday(d: Date): boolean {
  return d.getDay() === 5;
}

function muscleGroup(dayName: string, exerciseNames: string[]): string {
  const text = `${dayName} ${exerciseNames.join(" ")}`.toLowerCase();
  if (/pierna|cuadri|femoral|gemelo|sentadilla|prensa|peso muerto/.test(text)) return "pierna";
  if (/pecho|press banca|press inclinado|apertura/.test(text)) return "pecho";
  if (/espalda|remo|dominada|jalon|pull/.test(text)) return "espalda";
  if (/hombro|press militar|elevacion|deltoides/.test(text)) return "hombro";
  if (/biceps|curl/.test(text)) return "biceps";
  if (/triceps|extension/.test(text)) return "triceps";
  if (/abdomen|core|plancha/.test(text)) return "core";
  if (/gluteo|hip thrust/.test(text)) return "gluteo";
  return "entrenamiento";
}

const MUSCLE_PHRASE: Record<string, string> = {
  pierna: "¡Vamos que hoy toca pierna!",
  pecho: "¡Vamos que hoy toca pecho!",
  espalda: "¡Vamos que hoy toca espalda!",
  hombro: "¡Vamos que hoy toca hombro!",
  biceps: "¡Vamos que hoy toca bíceps!",
  triceps: "¡Vamos que hoy toca tríceps!",
  core: "¡Vamos que hoy toca core!",
  gluteo: "¡Vamos que hoy toca glúteo!",
  entrenamiento: "¡Vamos que hoy toca entrenar!",
};

async function todayCompleted(supabase: any, clientId: string, routine: any): Promise<boolean> {
  const exIds: string[] = (routine?.exercises ?? []).map((e: any) => e.id).filter(Boolean);
  if (exIds.length === 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  const { data: logs } = await supabase
    .from("sets_logs")
    .select("exercise_id, set_number, actual_reps, actual_weight")
    .eq("client_id", clientId)
    .eq("log_date", today)
    .in("exercise_id", exIds)
    .gt("set_number", 0);
  const done = new Set<string>();
  for (const r of (logs ?? []) as { exercise_id: string; actual_reps: number | null; actual_weight: number | null }[]) {
    if (r.actual_reps != null || r.actual_weight != null) done.add(r.exercise_id);
  }
  return exIds.every((id) => done.has(id));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = argentinaNow();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const isMorning = hour === 13;
  const isEvening = hour === 20 && minute >= 30;
  if (!isMorning && !isEvening) {
    return NextResponse.json({ ok: true, skipped: "fuera de ventana", hour, minute });
  }

  const supabase = getSupabaseAdmin() as any;

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, activo")
    .eq("role", "client")
    .eq("activo", true);

  let enqueued = 0;
  for (const c of (clients ?? []) as { id: string; full_name: string | null }[]) {
    const { data: routines } = await supabase
      .from("routines")
      .select("id, day_name, name, week_number, active, exercises(id, name)")
      .eq("client_id", c.id)
      .eq("active", true)
      .order("week_number", { ascending: true })
      .order("position", { ascending: true })
      .limit(1);

    const routine = (routines ?? [])[0] as
      | { id: string; day_name: string | null; name: string | null; exercises: { id: string; name: string }[] | null }
      | undefined;

    const dayName = (routine?.day_name || routine?.name || "").trim();
    const exNames = (routine?.exercises ?? []).map((e) => e.name || "");
    const group = muscleGroup(dayName, exNames);
    const name = c.full_name || "atleta";

    if (isMorning) {
      const ai = await generatePersonalizedPush({
        clientId: c.id,
        name: name,
        kind: "morning",
        muscleGroup: group,
        dayName,
      });
      await supabase.from("push_queue").insert({
        target: "client",
        client_id: c.id,
        title: "Nocito Coach",
        body: ai || `${MUSCLE_PHRASE[group]} Preparate para darlo todo hoy.`,
        url: "/app",
        tag: `motivation-morning-${c.id}-${now.toISOString().slice(0, 10)}`,
      });
      enqueued += 1;
    } else {
      const completed = await todayCompleted(supabase, c.id, routine);
      if (completed) {
        const ai = await generatePersonalizedPush({
          clientId: c.id,
          name: name,
          kind: "evening_completed",
        });
        await supabase.from("push_queue").insert({
          target: "client",
          client_id: c.id,
          title: "Nocito Coach",
          body: ai || "Buen trabajo hoy. Completaste tu rutina: cada serie cuenta. Descansá y recuperate.",
          url: "/app",
          tag: `followup-evening-${c.id}-${now.toISOString().slice(0, 10)}`,
        });
      } else {
        const ai = await generatePersonalizedPush({
          clientId: c.id,
          name: name,
          kind: "evening_audit",
        });
        await supabase.from("push_queue").insert({
          target: "client",
          client_id: c.id,
          title: "Nocito Coach",
          body: ai || "¿Qué pasó? ¿Por qué no completaste los datos en la app? ¿No fuiste a entrenar o te olvidaste de completarlos?",
          url: "/app?push=audit",
          tag: `followup-evening-${c.id}-${now.toISOString().slice(0, 10)}`,
        });
      }
      enqueued += 1;

      if (isFriday(now)) {
        const aiW = await generatePersonalizedPush({
          clientId: c.id,
          name: name,
          kind: "weekly",
        });
        await supabase.from("push_queue").insert({
          target: "client",
          client_id: c.id,
          title: "Nocito Coach",
          body: aiW || "Resumen semanal: revisá tu progreso y elegí una opción de mejora.",
          url: "/app?push=weekly",
          tag: `weekly-summary-${c.id}-${now.toISOString().slice(0, 10)}`,
        });
        enqueued += 1;
      }
    }
  }

  fetch(new URL("/api/app/push/flush", req.url), {
    method: "POST",
    headers: { cookie: req.headers.get("cookie") || "" },
  }).catch(() => {});

  return NextResponse.json({ ok: true, window: isMorning ? "morning" : "evening", enqueued });
}
