import { Resend } from "resend";

export const DESTINATION_EMAIL = process.env.DESTINATION_EMAIL ?? "";
export const SENDER_EMAIL = "Onboarding <onboarding@resend.dev>";

let resendClient: Resend | null = null;

export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Falta RESEND_API_KEY en las Environment Variables del proyecto.");
  }
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}