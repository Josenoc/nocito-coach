import { getResend, getDestinationEmail, SENDER_EMAIL } from "./resend";
import { generatePayload } from "./routine-gen";
import { renderRoutineHtml, renderRoutineText } from "./routine";
import { renderRoutinePdf } from "./routine-pdf";

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
  return { ok: true as const, id: result.data?.id };
}