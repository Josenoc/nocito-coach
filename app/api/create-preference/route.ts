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
    return NextResponse.json(
      { ok: false, error: "El plan elegido no es válido." },
      { status: 400 }
    );
  }

  let saved: Record<string, unknown> | undefined;
  try {
    saved = clientRef ? await getRoutine(clientRef) : undefined;
  } catch (err) {
    console.error("[create-preference] lectura de rutina:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudo consultar la base de datos. Verificá que DATABASE_URL esté configurada y que la base exista.",
      },
      { status: 500 }
    );
  }

  const savedObj = saved ?? {};
  const name =
    (typeof savedObj.name === "string" && savedObj.name) ||
    (typeof diagnostic.name === "string" && diagnostic.name) ||
    "Cliente";
  const contact = savedObj.contact ?? diagnostic.contact ?? "";

  try {
    if (clientRef) await attachPlan(clientRef, plan.name);
  } catch (err) {
    console.error("[create-preference] attachPlan:", err);
    return NextResponse.json(
      { ok: false, error: "No se pudo registrar el plan elegido." },
      { status: 500 }
    );
  }

  const base = siteBaseUrl();
  const encodedName = encodeURIComponent(name);

  let initPoint: string | undefined;
  try {
    const result = await mpPreference.create({
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