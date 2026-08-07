interface D1RunResult {
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1RunResult>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  STATS_DB: D1Database;
  VISITOR_HASH_SALT: string;
}

interface PagesContext {
  request: Request;
  env: Env;
  next(): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}

const TRACKED_HOSTS = new Set([
  "selfdefensesondrio.it",
  "www.selfdefensesondrio.it",
  "kravmagasondrio.it",
  "www.kravmagasondrio.it",
  "difesapersonalesondrio.it",
  "www.difesapersonalesondrio.it",
]);

const BOT_PATTERN = /bot|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse/i;

const romeDate = (date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const response = await context.next();
  const request = context.request;
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  const userAgent = request.headers.get("user-agent") ?? "";
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const isPage = request.method === "GET" && acceptsHtml && response.ok;

  if (
    isPage &&
    TRACKED_HOSTS.has(hostname) &&
    !BOT_PATTERN.test(userAgent) &&
    context.env.STATS_DB &&
    context.env.VISITOR_HASH_SALT
  ) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const visitDate = romeDate();
    const visitorHash = await sha256(
      `${context.env.VISITOR_HASH_SALT}|${visitDate}|${ip}|${userAgent}`
    );

    context.waitUntil(
      context.env.STATS_DB.prepare(
        `INSERT OR IGNORE INTO daily_visitors
          (visit_date, hostname, visitor_hash)
         VALUES (?, ?, ?)`
      )
        .bind(visitDate, hostname, visitorHash)
        .run()
    );
  }

  return response;
};
