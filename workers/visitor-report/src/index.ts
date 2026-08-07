interface ReportRow {
  hostname: string;
  visitors: number;
}

interface D1Result<T> {
  results: T[];
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  STATS_DB: D1Database;
  REPORT_SECRET: string;
  REPORT_ENDPOINT: string;
}

interface ScheduledController {
  scheduledTime: number;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const TRACKED_HOSTS = [
  "selfdefensesondrio.it",
  "www.selfdefensesondrio.it",
  "kravmagasondrio.it",
  "www.kravmagasondrio.it",
  "difesapersonalesondrio.it",
  "www.difesapersonalesondrio.it",
];

const romeDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const previousRomeDate = (scheduledTime: number): string => {
  const date = new Date(scheduledTime);
  date.setUTCDate(date.getUTCDate() - 1);
  return romeDate(date);
};

const sendReport = async (env: Env, scheduledTime: number): Promise<void> => {
  const date = previousRomeDate(scheduledTime);
  const result = await env.STATS_DB.prepare(
    `SELECT hostname, COUNT(*) AS visitors
       FROM daily_visitors
      WHERE visit_date = ?
      GROUP BY hostname`
  ).bind(date).all<ReportRow>();

  const counts = new Map(result.results.map((row) => [row.hostname, Number(row.visitors)]));
  const rows = TRACKED_HOSTS.map((hostname) => ({
    hostname,
    visitors: counts.get(hostname) ?? 0,
  }));

  const response = await fetch(env.REPORT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.REPORT_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ date, rows }),
  });

  if (!response.ok) {
    throw new Error(`Report endpoint failed: ${response.status} ${await response.text()}`);
  }

  await env.STATS_DB.prepare(
    "DELETE FROM daily_visitors WHERE visit_date < date(?, '-35 days')"
  ).bind(date).run();
};

export default {
  async scheduled(controller: ScheduledController, env: Env, context: WorkerExecutionContext): Promise<void> {
    context.waitUntil(sendReport(env, controller.scheduledTime));
  },

  async fetch(request: Request): Promise<Response> {
    return new Response(request.method === "GET" ? "Visitor report worker attivo" : "Metodo non consentito", {
      status: request.method === "GET" ? 200 : 405,
    });
  },
};
