import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/auth";
import { sendClientUpdatedEmail } from "@/app/lib/notify";
import { sendCoachPush } from "@/app/lib/push";
import type { Anamnesis } from "@/lib/app-types";

export const dynamic = "force-dynamic";

const SEXOS = ["Masculino", "Femenino", "Otro"];
const OBJETIVOS = ["hipertrofia", "perdida-grasa", "fuerza", "recomposicion", "rendimiento-deportivo"];
const DIAS_VALIDOS = [3, 4, 5];
const NUTRICION = ["omnivoro", "vegetariano", "carnivoro", "vegano"];
const LUGARES = ["gimnasio", "casa", "aire-libre"];
const EXPERIENCIAS = ["principiante", "intermedio", "avanzado"];
const ACTIVIDADES = ["sedentario", "ligero", "moderado", "alto", "muy-alto"];
const SUENO = ["mala", "regular", "buena", "excelente"];

const FIELD_LABELS: Record<string, string> = {
  age: "Edad",
  height_cm: "Altura",
  weight_kg: "Peso",
  body_fat_pct: "% de grasa corporal",
  sex: "Sexo",
  goal: "Objetivo",
  training_days: "Días/semana",
  nutrition: "Alimentación",
  training_place: "Lugar de entrenamiento",
  experience: "Experiencia",
  training_years: "Años de entrenamiento",
  activity_level: "Actividad diaria",
  sleep_quality: "Calidad de sueño",
  injuries: "Lesiones / notas",
  food_restrictions: "Restricciones alimentarias",
};

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function cleanNote(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const clientId =
      session.role === "coach" && body?.clientId
        ? String(body.clientId)
        : session.role === "client"
        ? session.id
        : "";

    if (!clientId) {
      return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current } = await supabase
      .from("profiles")
      .select("email, full_name, phone, anamnesis")
      .eq("id", clientId)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
    }

    const anamnesis: Anamnesis = (current.anamnesis as Anamnesis) ?? ({} as Anamnesis);
    const changes: string[] = [];

    const profileUpdate: Record<string, unknown> = {};

    if (typeof body?.full_name === "string" && body.full_name.trim()) {
      const next = body.full_name.trim().slice(0, 120);
      if (next !== (current.full_name ?? "")) {
        profileUpdate.full_name = next;
        changes.push("Nombre");
      }
    }
    if (typeof body?.phone === "string") {
      const next = body.phone.trim().slice(0, 40);
      if (next !== (current.phone ?? "")) {
        profileUpdate.phone = next;
        changes.push("Teléfono");
      }
    }

    const setNumber = (
      key: keyof Anamnesis,
      raw: unknown,
      valid: (n: number) => boolean,
      min: number,
      max: number
    ) => {
      if (raw === undefined) return;
      const n = Number(raw);
      if (!Number.isFinite(n) || !valid(n)) return;
      const clamped = Math.min(max, Math.max(min, n));
      if ((anamnesis as any)[key] !== clamped) {
        (anamnesis as any)[key] = clamped;
        changes.push(FIELD_LABELS[key as string] ?? String(key));
      }
    };

    const setDecimal = (
      key: keyof Anamnesis,
      raw: unknown,
      valid: (n: number) => boolean,
      min: number,
      max: number
    ) => {
      if (raw === undefined || raw === null || String(raw).trim() === "") return;
      const n = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(n) || !valid(n)) return;
      const rounded = Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
      if ((anamnesis as any)[key] !== rounded) {
        (anamnesis as any)[key] = rounded;
        changes.push(FIELD_LABELS[key as string] ?? String(key));
      }
    };

    const setString = (key: keyof Anamnesis, raw: unknown, allowed?: string[]) => {
      if (typeof raw !== "string") return;
      const value = raw.trim();
      if (!value) return;
      if (allowed && !allowed.includes(value)) return;
      if ((anamnesis as any)[key] !== value) {
        (anamnesis as any)[key] = value;
        changes.push(FIELD_LABELS[key as string] ?? String(key));
      }
    };

    setString("sex", body?.sex, SEXOS);
    setNumber("age", body?.age, (n) => n >= 10 && n <= 100, 10, 100);
    setNumber("height_cm", body?.height_cm, (n) => n > 0, 100, 250);
    setNumber(
      "weight_kg",
      body?.weight_kg,
      (n) => n >= 30 && n <= 300,
      30,
      300
    );
    setString("goal", body?.goal, OBJETIVOS);
    setNumber("training_days", body?.training_days, (n) => DIAS_VALIDOS.includes(n), 3, 5);
    setString("nutrition", body?.nutrition, NUTRICION);
    setString("training_place", body?.training_place, LUGARES);
    setString("experience", body?.experience, EXPERIENCIAS);
    setDecimal("body_fat_pct", body?.body_fat_pct, (n) => n >= 3 && n <= 60, 3, 60);
    setNumber("training_years", body?.training_years, (n) => n >= 0 && n <= 60, 0, 60);
    setString("activity_level", body?.activity_level, ACTIVIDADES);
    setString("sleep_quality", body?.sleep_quality, SUENO);

    if (typeof body?.injuries === "string") {
      const value = body.injuries.trim().slice(0, 1200);
      if ((anamnesis.injuries ?? "") !== value) {
        anamnesis.injuries = value;
        changes.push(FIELD_LABELS.injuries);
      }
    }
    if (typeof body?.food_restrictions === "string") {
      const value = body.food_restrictions.trim().slice(0, 1200);
      if ((anamnesis.food_restrictions ?? "") !== value) {
        anamnesis.food_restrictions = value;
        changes.push(FIELD_LABELS.food_restrictions);
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({ ok: true, anamnesis, changes: [] });
    }

    anamnesis.clientUpdatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({ ...profileUpdate, anamnesis })
      .eq("id", clientId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    sendClientUpdatedEmail({
      name: current.full_name || current.email,
      email: current.email,
      changes,
    }).catch((err) => console.error("[onboarding] aviso al coach:", err));

    sendCoachPush({
      title: "Nocito Coach",
      body: `${current.full_name || current.email} actualizó sus datos`,
      url: "/app/admin",
    }).catch((err) => console.error("[onboarding] push al coach:", err));

    return NextResponse.json({ ok: true, anamnesis, changes });
  } catch {
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
