import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getCoach } from "@/lib/auth";
import type { NutritionPlan } from "@/lib/app-types";

export const dynamic = "force-dynamic";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizeMeals(value: unknown): [string, string][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (Array.isArray(raw)) {
        return [String(raw[0] ?? "").trim(), String(raw[1] ?? "").trim()] as [
          string,
          string
        ];
      }
      const o = (raw ?? {}) as Record<string, unknown>;
      return [String(o.name ?? "").trim(), String(o.text ?? "").trim()] as [
        string,
        string
      ];
    })
    .filter(([name, text]) => name || text);
}

export async function POST(req: NextRequest) {
  const coach = await getCoach();
  if (!coach) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const clientId = String(body?.clientId ?? body?.client_id ?? "");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId requerido" }, { status: 400 });
  }

  const raw = (body?.nutrition ?? {}) as Record<string, unknown>;
  const nutrition: NutritionPlan = {
    cal: num(raw.cal),
    prot: num(raw.prot),
    carbs: num(raw.carbs),
    fat: num(raw.fat),
    proteinSources: String(raw.proteinSources ?? "").trim(),
    meals: normalizeMeals(raw.meals),
  };

  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({ nutrition_plan: nutrition })
    .eq("id", clientId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, nutrition });
}
