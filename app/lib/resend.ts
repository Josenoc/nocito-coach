import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY ?? "";

export const resend = new Resend(apiKey);

export const DESTINATION_EMAIL = process.env.DESTINATION_EMAIL ?? "";
export const SENDER_EMAIL = "Onboarding <onboarding@resend.dev>";