import { NextResponse } from "next/server";
import { mpPreference, siteBaseUrl, notificationUrl } from "@/app/lib/mp";
import { getPlan } from "@/app/lib/plans";
import { getRoutine, attachPlan } from "@/app/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emailFromContact(contact: unknown): string {
  const c = typeof contact === "string" ? contact.trim() : "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return c;
  return "comprador@example.com";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const clientRef = typeof o.clientRef === "string" ? o.clientRef : "";
  const planIndex = Number(o.planIndex);
  const diagnostic = ((o.diagnostic ?? {}) as Record<string, unknown>) || {};

  const plan = getPlan(planIndex);
  if (!plan) {
    return NextResponse.json({ ok: false, error: "Plan inválido" }, { status: 400 });
  }

  const saved = clientRef ? await getRoutine(clientRef) : undefined;
  const savedObj = saved ?? {};
  const name =
    (typeof savedObj.name === "string" && savedObj.name) ||
    (typeof diagnostic.name === "string" && diagnostic.name) ||
    "Cliente";
  const contact = savedObj.contact ?? diagnostic.contact ?? "";

  if (clientRef) await attachPlan(clientRef, plan.name);

  const base = siteBaseUrl();
  const encodedName = encodeURIComponent(name);

  const preferencePayload = {
    body: {
      items: [
        {
          id: plan.key,
          title: plan.name,
          description: "Asesoría personalizada " + plan.name + " — nocito.coach",
          quantity: 1,
          currency_id: "ARS",
          unit_price: plan.price,
        },
      ],
      payer: {
        name: name,
        email: emailFromContact(contact),
      },
      external_reference: clientRef || "direct",
      back_urls: {
        success: `${base}/exito?name=${encodedName}`,
        pending: `${base}/exito?name=${encodedName}&status=pending`,
        failure: `${base}/`,
      },
      auto_return: "approved",
      notification_url: notificationUrl(),
      metadata: {
        client_ref: clientRef,
        plan_key: plan.key,
        plan_name: plan.name,
        client_name: name,
      },
    },
  };

  let initPoint: string | undefined;
  try {
    const result = await mpPreference.create(preferencePayload);
    initPoint = result?.init_point;
  } catch (err) {
    console.error("MP create-preference error:", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo crear la preferencia de pago" },
      { status: 502 }
    );
  }

  if (!initPoint) {
    return NextResponse.json(
      { ok: false, error: "Mercado Pago no devolvió init_point" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, initPoint });
}