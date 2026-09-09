import { Resend } from "resend";

let client: Resend | null = null;

export function resendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Falta a variavel RESEND_API_KEY para enviar e-mails.");
  }

  if (!client) {
    client = new Resend(key);
  }

  return client;
}

export function resendFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? "Planvoro <onboarding@resend.dev>";
}

export function resendReplyTo() {
  const value = process.env.RESEND_REPLY_TO?.trim();
  return value ? [value] : undefined;
}
