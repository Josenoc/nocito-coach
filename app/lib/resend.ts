import { Resend } from "resend";

export const SENDER_EMAIL = "onboarding@resend.dev";

export function getDestinationEmail(): string {
  return process.env.DESTINATION_EMAIL ?? "";
}

let resendClient: Resend | null = null;

export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("Falta RESEND_API_KEY en las Environment Variables del proyecto.");
  }
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}