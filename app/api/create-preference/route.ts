import { NextResponse } from "next/server";
import { mpPreference, siteBaseUrl } from "@/app/lib/mp";
import { getPlan } from "@/app/lib/plans";

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
  const planIndex = Number(o.planIndex);
  const diagnostic = ((o.diagnostic ?? {}) as Record<string, unknown>) || {};

  const plan = getPlan(planIndex);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "El plan elegido no es válido." },
      { status: 400 }
    );
  }

  const name =
    (typeof diagnostic.name === "string" && diagnostic.name) || "Cliente";
  const contact =
    (typeof diagnostic.contact === "string" && diagnostic.contact) || "";

  const base = siteBaseUrl();

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
        back_urls: {
          success: `${base}/exito?name=${encodeURIComponent(name)}`,
          pending: `${base}/exito?name=${encodeURIComponent(name)}&status=pending`,
          failure: `${base}/`,
        },
        auto_return: "approved",
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