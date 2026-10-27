import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

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
      .select("id, day_name, name, week_number, active, exercises(name)")
      .eq("client_id", c.id)
      .eq("active", true)
      .order("week_number", { ascending: true })
      .order("position", { ascending: true })
      .limit(1);

    const routine = (routines ?? [])[0] as
      | { id: string; day_name: string | null; name: string | null; exercises: { name: string }[] | null }
      | undefined;

    const dayName = (routine?.day_name || routine?.name || "").trim();
    const exNames = (routine?.exercises ?? []).map((e) => e.name || "");
    const group = muscleGroup(dayName, exNames);
    const name = c.full_name || "atleta";

    if (isMorning) {
      await supabase.from("push_queue").insert({
        target: "client",
        client_id: c.id,
        title: "Nocito Coach",
        body: `${MUSCLE_PHRASE[group]} Preparate para darlo todo hoy.`,
        url: "/app",
        tag: `motivation-morning-${c.id}-${now.toISOString().slice(0, 10)}`,
      });
      enqueued += 1;
    } else {
      await supabase.from("push_queue").insert({
        target: "client",
        client_id: c.id,
        title: "Nocito Coach",
        body: "¿Cómo te fue hoy? Registrá tus series para no perder el progreso.",
        url: "/app",
        tag: `followup-evening-${c.id}-${now.toISOString().slice(0, 10)}`,
      });
      enqueued += 1;

      if (isFriday(now)) {
        await supabase.from("push_queue").insert({
          target: "client",
          client_id: c.id,
          title: "Nocito Coach",
          body: "Resumen semanal: revisá tu progreso y planificá la próxima semana.",
          url: "/app",
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
