import { NextResponse } from "next/server";
import { mpPreference, siteBaseUrl } from "@/app/lib/mp";
import { getPlan } from "@/app/lib/plans";
import { buildNutrition, OBJECTIVE_LABELS } from "@/app/lib/routine-gen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emailFromContact(contact: unknown): string {
  const c = typeof contact === "string" ? contact.trim() : "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return c;
  return "comprador@example.com";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const planIndex = Number(o.planIndex);
  const diagnostic = ((o.diagnostic ?? {}) as Record<string, unknown>) || {};

  const plan = getPlan(planIndex);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "El plan elegido no es válido." },
      { status: 400 }
    );
  }

  const name = asString(diagnostic.name, "Cliente");
  const contact = asString(diagnostic.contact);
  const objectiveKey = asString(diagnostic.objective);
  const experienceKey = asString(diagnostic.experience);
  const days = asNumber(diagnostic.days, 3);
  const age = asNumber(diagnostic.age, 0);
  const height = asNumber(diagnostic.height, 0);
  const weight = asNumber(diagnostic.weight, 75);
  const prefsRaw = Array.isArray(diagnostic.prefs) ? diagnostic.prefs.map(String) : [];
  const prefs = prefsRaw.length > 0 ? prefsRaw : ["Omnívoro"];
  const fecha = asString(diagnostic.fecha, new Date().toISOString().slice(0, 10));

  const nutrition = buildNutrition(objectiveKey, weight, prefs);

  const metadata: Record<string, string | number> = {
    name,
    contact,
    age,
    height,
    weight,
    objectiveKey,
    experienceKey,
    days,
    prefs: JSON.stringify(prefs),
    fecha,
    planName: plan.name,
    planKey: plan.key,
    planPrice: plan.price,
    macroCal: nutrition.cal,
    macroProt: nutrition.prot,
    macroCarbs: nutrition.carbs,
    macroFat: nutrition.fat,
  };

  const host = process.env.VERCEL_URL || "localhost:3000";
  const base = siteBaseUrl();
  const notificationUrl = `https://${host}/api/webhooks/mercadopago`;

  let initPoint: string | undefined;
  try {
    const result = await mpPreference.create({
      body: {
        items: [
          {
            id: plan.key,
            title: plan.name,
            description:
              "Asesoría personalizada " +
              plan.name +
              " — " +
              (OBJECTIVE_LABELS[objectiveKey] || objectiveKey),
            quantity: 1,
            currency_id: "ARS",
            unit_price: plan.price,
          },
        ],
        payer: {
          name: name,
          email: emailFromContact(contact),
        },
        back_urls: {
          success: `${base}/exito?name=${encodeURIComponent(name)}`,
          pending: `${base}/exito?name=${encodeURIComponent(name)}&status=pending`,
          failure: `${base}/`,
        },
        auto_return: "approved",
        notification_url: notificationUrl,
        metadata,
      },
    });
    initPoint = result?.init_point;
  } catch (err) {
    console.error("[create-preference] Mercado Pago:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudo crear el pago en Mercado Pago. Verificá MP_ACCESS_TOKEN y los datos del plan.",
      },
      { status: 500 }
    );
  }

  if (!initPoint) {
    return NextResponse.json(
      { ok: false, error: "Mercado Pago no devolvió el link de pago." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, initPoint });
}