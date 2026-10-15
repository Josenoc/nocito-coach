import { getResend, getDestinationEmail, SENDER_EMAIL } from "./resend";
import { generatePayload } from "./routine-gen";
import { renderRoutineHtml, renderRoutineText } from "./routine";
import { renderRoutinePdf } from "./routine-pdf";
import {
  provisionAlumno,
  provisionProfile,
  sendAlumnoAccessEmail,
  isDeliverableEmail,
} from "./alumnos";

const TOKEN = process.env.MP_ACCESS_TOKEN || "";

export async function getPayment(paymentId: string | number) {
  const resp = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
    }
  );
  if (!resp.ok) return null;
  return (await resp.json()) as Record<string, unknown>;
}

export async function sendRoutineForPaymentId(paymentId: string | number) {
  const payment = await getPayment(paymentId);
  if (!payment) {
    return { ok: false as const, error: `MP no devolvió info del pago ${paymentId}` };
  }
  if (payment.status !== "approved") {
    return {
      ok: true as const,
      skipped: true as const,
      status: String(payment.status),
    };
  }

  const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
  const payload = generatePayload(metadata);
  if (!payload) {
    return {
      ok: false as const,
      error: `sin datos del alumno en metadata, pago ${paymentId}`,
    };
  }

  const subject = `PAGO CONFIRMADO - Rutina de ${payload.name}`;
  const pdf = await renderRoutinePdf(payload);
  const result = await getResend().emails.send({
    from: SENDER_EMAIL,
    to: getDestinationEmail(),
    subject,
    html: renderRoutineHtml(payload),
    text: renderRoutineText(payload),
    attachments: [
      {
        filename: `Rutina ${payload.name}.pdf`,
        content: pdf.toString("base64"),
      },
    ],
  });

  if (result.error) {
    return { ok: false as const, error: `Resend: ${result.error.message}` };
  }

  const access = await deliverAccess(payment, payload.name);

  return { ok: true as const, id: result.data?.id, access };
}

async function deliverAccess(
  payment: Record<string, unknown>,
  name: string
): Promise<Record<string, unknown>> {
  try {
    const payer = (payment.payer ?? {}) as Record<string, unknown>;
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const candidate =
      (isDeliverableEmail(payer.email) && payer.email.toLowerCase()) ||
      (isDeliverableEmail(metadata.contact) && metadata.contact.toLowerCase()) ||
      "";
    if (!candidate) return { provisioned: false, reason: "sin email" };

    const prov = await provisionAlumno({ name, email: candidate });
    if ('error' in prov) {
      console.error("[access] provisionAlumno:", prov.error);
      return { provisioned: false, reason: prov.error };
    }

    const prof = await provisionProfile({ name, email: prov.email });
    if ('error' in prof) {
      console.error("[access] provisionProfile:", prof.error);
      return { provisioned: false, reason: prof.error };
    }

    const mail = await sendAlumnoAccessEmail({
      name,
      email: prov.email,
      pin: prof.pin,
      existing: prof.existing || prov.existing,
    });
    if (!mail.ok) console.error("[access] email:", mail.error);

    return {
      provisioned: true,
      existing: prof.existing || prov.existing,
      emailed: mail.ok,
      emailedTo: mail.to ?? null,
    };
  } catch (err: any) {
    console.error("[access]", err);
    return { provisioned: false, reason: err?.message || String(err) };
  }
}