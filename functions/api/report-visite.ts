interface Env {
  REPORT_SECRET: string;
  RESEND_API_KEY: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

interface ReportRow {
  hostname: string;
  visitors: number;
}

const REPORT_EMAIL = "dt.claudio.bonini@gmail.com";
const SENDER_EMAIL = "info@selfdefensesondrio.it";
const TRACKED_HOSTS = [
  "selfdefensesondrio.it",
  "www.selfdefensesondrio.it",
  "kravmagasondrio.it",
  "www.kravmagasondrio.it",
  "difesapersonalesondrio.it",
  "www.difesapersonalesondrio.it",
];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const authorization = context.request.headers.get("authorization");
  if (!context.env.REPORT_SECRET || authorization !== `Bearer ${context.env.REPORT_SECRET}`) {
    return new Response("Non autorizzato", { status: 401 });
  }

  if (!context.env.RESEND_API_KEY) {
    return new Response("Servizio email non configurato", { status: 503 });
  }

  const payload = await context.request.json() as { date?: unknown; rows?: unknown };
  const date = typeof payload.date === "string" ? payload.date : "";
  const incomingRows = Array.isArray(payload.rows) ? payload.rows : [];
  const counts = new Map<string, number>();

  for (const row of incomingRows as ReportRow[]) {
    if (TRACKED_HOSTS.includes(row.hostname) && Number.isFinite(row.visitors)) {
      counts.set(row.hostname, Math.max(0, Math.trunc(row.visitors)));
    }
  }

  const rows = TRACKED_HOSTS.map((hostname) => ({
    hostname,
    visitors: counts.get(hostname) ?? 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.visitors, 0);
  const tableRows = rows.map((row) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd">${escapeHtml(row.hostname)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ddd;text-align:right"><strong>${row.visitors}</strong></td>
    </tr>`).join("");

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Self Defense Sondrio <${SENDER_EMAIL}>`,
      to: [REPORT_EMAIL],
      subject: `Visite al sito — ${date}`,
      html: `
        <h1>Report visite del ${escapeHtml(date)}</h1>
        <p>Visite giornaliere rilevate da Cloudflare, suddivise per dominio.</p>
        <table style="border-collapse:collapse;min-width:480px">
          <thead><tr><th style="padding:8px 12px;text-align:left">Dominio</th><th style="padding:8px 12px;text-align:right">Visitatori</th></tr></thead>
          <tbody>${tableRows}</tbody>
          <tfoot><tr><td style="padding:10px 12px"><strong>Totale visite</strong></td><td style="padding:10px 12px;text-align:right"><strong>${total}</strong></td></tr></tfoot>
        </table>
        <p style="color:#666;font-size:13px">Le visite Cloudflare non corrispondono necessariamente a persone uniche. La stessa persona può generare più visite e comparire su domini diversi.</p>
      `,
      text: [
        `Report visite del ${date}`,
        "",
        ...rows.map((row) => `${row.hostname}: ${row.visitors}`),
        "",
        `Totale visite: ${total}`,
        "",
        "Nota: le visite Cloudflare non corrispondono necessariamente a persone uniche.",
      ].join("\n"),
    }),
  });

  if (!emailResponse.ok) {
    console.error("visitor_report_email_error", emailResponse.status, await emailResponse.text());
    return new Response("Invio non riuscito", { status: 502 });
  }

  return Response.json({ sent: true, date, total });
};
