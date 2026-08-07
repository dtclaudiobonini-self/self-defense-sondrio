interface Env {
  CLOUDFLARE_API_TOKEN: string;
  REPORT_SECRET: string;
  REPORT_ENDPOINT: string;
}

interface ScheduledController {
  scheduledTime: number;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface AnalyticsGroup {
  dimensions?: {
    clientRequestHTTPHost?: string;
  };
  sum?: {
    visits?: number;
  };
}

interface AnalyticsResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequestsAdaptiveGroups?: AnalyticsGroup[];
      }>;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
}

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

const TRACKED_ZONES = [
  {
    id: "6bd7cf5b0ac02a51bab0fd642302b354",
    hosts: ["selfdefensesondrio.it", "www.selfdefensesondrio.it"],
  },
  {
    id: "8f3e6574ee23e882971faa078be53e38",
    hosts: ["kravmagasondrio.it", "www.kravmagasondrio.it"],
  },
  {
    id: "483024a92fa756880fe481f37b049368",
    hosts: ["difesapersonalesondrio.it", "www.difesapersonalesondrio.it"],
  },
] as const;

const TRACKED_HOSTS = TRACKED_ZONES.flatMap((zone) => [...zone.hosts]);

const ANALYTICS_QUERY = `
  query DailyVisits($zoneTag: string!, $start: Time!, $end: Time!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequestsAdaptiveGroups(
          limit: 100
          filter: {
            datetime_geq: $start
            datetime_lt: $end
            requestSource: "eyeball"
          }
          orderBy: [sum_visits_DESC]
        ) {
          dimensions {
            clientRequestHTTPHost
          }
          sum {
            visits
          }
        }
      }
    }
  }
`;

const datePartsInRome = (date: Date): { year: number; month: number; day: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
};

const timeZoneOffsetMs = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );
  return asUtc - date.getTime();
};

const romeMidnightUtc = (year: number, month: number, day: number): Date => {
  const approximate = new Date(Date.UTC(year, month - 1, day));
  return new Date(approximate.getTime() - timeZoneOffsetMs(approximate));
};

const previousRomeDayRange = (scheduledTime: number): { date: string; start: string; end: string } => {
  const today = datePartsInRome(new Date(scheduledTime));
  const todayMidnight = romeMidnightUtc(today.year, today.month, today.day);
  const previousDay = datePartsInRome(new Date(todayMidnight.getTime() - 12 * 60 * 60 * 1000));
  const previousMidnight = romeMidnightUtc(previousDay.year, previousDay.month, previousDay.day);
  const date = `${previousDay.year}-${String(previousDay.month).padStart(2, "0")}-${String(previousDay.day).padStart(2, "0")}`;

  return {
    date,
    start: previousMidnight.toISOString(),
    end: todayMidnight.toISOString(),
  };
};

const normalizeHostname = (hostname: string): string =>
  hostname.toLowerCase().replace(/:(80|443)$/, "");

const readZoneVisits = async (
  token: string,
  zoneTag: string,
  start: string,
  end: string
): Promise<Map<string, number>> => {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: ANALYTICS_QUERY,
      variables: { zoneTag, start, end },
    }),
  });

  const payload = await response.json() as AnalyticsResponse;
  if (!response.ok || payload.errors?.length) {
    const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(`Cloudflare Analytics API failed (${response.status}): ${detail || "unknown error"}`);
  }

  const groups = payload.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  const counts = new Map<string, number>();

  for (const group of groups) {
    const rawHostname = group.dimensions?.clientRequestHTTPHost;
    if (!rawHostname) continue;
    const hostname = normalizeHostname(rawHostname);
    counts.set(hostname, (counts.get(hostname) ?? 0) + Number(group.sum?.visits ?? 0));
  }

  return counts;
};

const sendReport = async (env: Env, scheduledTime: number): Promise<void> => {
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is not configured");
  }

  const range = previousRomeDayRange(scheduledTime);
  const zoneCounts = await Promise.all(
    TRACKED_ZONES.map((zone) => readZoneVisits(env.CLOUDFLARE_API_TOKEN, zone.id, range.start, range.end))
  );
  const counts = new Map<string, number>();

  for (const zone of zoneCounts) {
    for (const [hostname, visits] of zone) {
      counts.set(hostname, (counts.get(hostname) ?? 0) + visits);
    }
  }

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
    body: JSON.stringify({ date: range.date, rows }),
  });

  if (!response.ok) {
    throw new Error(`Report endpoint failed: ${response.status} ${await response.text()}`);
  }
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
