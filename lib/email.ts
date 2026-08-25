import type { Trip } from "./types";
import { resendClient, resendFromEmail, resendReplyTo } from "./resend";

type InviteEmailInput = {
  destination: string;
  inviteUrl: string;
  publicUrl: string;
  inviterName: string;
  message?: string | null;
  recipientEmails: string[];
  trip: Pick<Trip, "start_date" | "end_date" | "party_size" | "is_solo">;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inviteSubject(destination: string, inviterName: string) {
  return `${inviterName} te chamou para planejar ${destination} no Planvoro`;
}

function inviteText({
  destination,
  inviteUrl,
  publicUrl,
  inviterName,
  message,
  trip,
}: Omit<InviteEmailInput, "recipientEmails">) {
  const lines = [
    `${inviterName} te convidou para planejar ${destination} no Planvoro.`,
    "",
    trip.is_solo
      ? "A viagem comecou no modo solo e agora pode virar um plano de grupo."
      : `Viagem para ${trip.party_size} pessoa${trip.party_size === 1 ? "" : "s"}.`,
    `Datas: ${trip.start_date} ate ${trip.end_date}`,
    "",
  ];

  if (message?.trim()) {
    lines.push("Mensagem do grupo:");
    lines.push(message.trim());
    lines.push("");
  }

  lines.push("Entrar e colaborar:");
  lines.push(inviteUrl);
  lines.push("");
  lines.push("Ver o roteiro publico:");
  lines.push(publicUrl);

  return lines.join("\n");
}

function inviteHtml({
  destination,
  inviteUrl,
  publicUrl,
  inviterName,
  message,
  trip,
}: Omit<InviteEmailInput, "recipientEmails">) {
  const safeDestination = escapeHtml(destination);
  const safeInviter = escapeHtml(inviterName);
  const safeMessage = message?.trim() ? escapeHtml(message.trim()).replaceAll("\n", "<br />") : "";
  const tripLabel = trip.is_solo
    ? "Uma viagem que comecou no modo solo agora pode virar um plano de grupo."
    : `Viagem para ${trip.party_size} pessoas.`;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Convite Planvoro</title>
  </head>
  <body style="margin:0;background:#f7f3ed;font-family:Arial,Helvetica,sans-serif;color:#132540;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f3ed;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #ebe1d4;">
            <tr>
              <td style="padding:32px 32px 20px;">
                <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#0e9c6b;font-weight:700;">Convite Planvoro</div>
                <h1 style="margin:14px 0 10px;font-size:30px;line-height:1.1;color:#132540;">${safeInviter} te chamou para planejar ${safeDestination}</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#5a6a80;">${escapeHtml(tripLabel)}</p>
                <p style="margin:0;font-size:14px;line-height:1.7;color:#5a6a80;">Datas: ${escapeHtml(trip.start_date)} ate ${escapeHtml(trip.end_date)}</p>
              </td>
            </tr>
            ${
              safeMessage
                ? `<tr>
              <td style="padding:0 32px 20px;">
                <div style="padding:16px 18px;border-radius:16px;background:#f7f3ed;color:#5a6a80;font-size:14px;line-height:1.7;">
                  <strong style="color:#132540;">Mensagem do grupo</strong><br />
                  ${safeMessage}
                </div>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:0 32px 20px;">
                <a href="${inviteUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#0e9c6b;color:#ffffff;text-decoration:none;font-weight:700;">Entrar na viagem</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 14px;">
                <p style="margin:0;font-size:13px;line-height:1.7;color:#5a6a80;">Se quiser ver o que ja existe antes de entrar, abra o roteiro publico:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <a href="${publicUrl}" style="color:#0b8fa8;font-size:13px;line-height:1.6;text-decoration:none;">${escapeHtml(publicUrl)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 28px;border-top:1px solid #ebe1d4;color:#8b97a6;font-size:12px;line-height:1.7;">
                Planvoro organiza roteiro, votos e gastos no mesmo lugar.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendTripInviteEmails(input: InviteEmailInput) {
  const resend = resendClient();
  const from = resendFromEmail();
  const replyTo = resendReplyTo();
  const subject = inviteSubject(input.destination, input.inviterName);
  const html = inviteHtml(input);
  const text = inviteText(input);

  const settled = await Promise.allSettled(
    input.recipientEmails.map((recipientEmail) =>
      resend.emails.send({
        from,
        to: recipientEmail,
        subject,
        html,
        text,
        replyTo,
        tags: [
          { name: "app", value: "planvoro" },
          { name: "flow", value: "trip_invite" },
        ],
      })
    )
  );

  const sent = settled.filter((item) => item.status === "fulfilled").length;
  const failed = settled.filter((item) => item.status === "rejected");

  if (sent === 0) {
    const first = failed[0];
    if (first?.status === "rejected") {
      throw first.reason instanceof Error ? first.reason : new Error("Falha ao enviar os convites.");
    }
    throw new Error("Falha ao enviar os convites.");
  }

  return {
    sent,
    failed: failed.length,
  };
}
