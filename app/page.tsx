import Dashboard from "./dashboard";
import {
  cityDataUrls,
  dashboardConfig,
  mapSourceRecord,
  publicDashboardConfig,
} from "../lib/dashboard-config";
import type { Permit } from "../lib/permit";

type GeoFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

async function fetchPermits(): Promise<Permit[]> {
  const response = await fetch(cityDataUrls.data, {
    headers: { accept: "application/geo+json, application/json" },
    next: { revalidate: dashboardConfig.feed.refreshSeconds },
    signal: AbortSignal.timeout(dashboardConfig.feed.requestTimeoutMilliseconds),
  });

  if (!response.ok) throw new Error(`Open data returned ${response.status}`);
  const geojson = (await response.json()) as { features?: GeoFeature[] };
  return (geojson.features ?? []).map((feature) =>
    mapSourceRecord(feature.properties ?? {}, feature.geometry?.coordinates),
  );
}

async function fetchCityDataUpdatedAt(): Promise<string | null> {
  const response = await fetch(cityDataUrls.metadata, {
    headers: { accept: "application/json" },
    next: { revalidate: dashboardConfig.feed.refreshSeconds },
    signal: AbortSignal.timeout(dashboardConfig.feed.requestTimeoutMilliseconds),
  });

  if (!response.ok) return null;
  const metadata = (await response.json()) as { dataUpdatedAt?: string | null };
  return metadata.dataUpdatedAt ?? null;
}

function normalizeAppealNumber(value?: string) {
  return value?.match(/(?:^|\D)(20\d{2}-\d{4})(?:\D|$)/)?.[1] ?? null;
}

async function fetchAppealReportLinks(): Promise<Map<string, string>> {
  const response = await fetch(dashboardConfig.links.activeAppealsUrl, {
    headers: { accept: "text/html" },
    next: { revalidate: dashboardConfig.links.appealRefreshSeconds },
    signal: AbortSignal.timeout(dashboardConfig.links.appealRequestTimeoutMilliseconds),
  });

  if (!response.ok) return new Map();
  const html = await response.text();
  const reports = new Map<string, string>();
  const reportLink = /<a\b[^>]*\bhref=(["'])([^"']+)\1[^>]*>/gi;

  for (const match of html.matchAll(reportLink)) {
    const beforeLink = html.slice(Math.max(0, (match.index ?? 0) - 12000), match.index);
    const appealNumbers = beforeLink.match(/\b20\d{2}-\d{4}\b/g);
    const appealNumber = appealNumbers?.at(-1);
    if (!appealNumber) continue;

    const decodedHref = match[2].replaceAll("&amp;", "&").replaceAll("&#38;", "&");
    try {
      const url = new URL(decodedHref, dashboardConfig.links.activeAppealsUrl);
      if (url.protocol === "https:" && url.hostname === dashboardConfig.links.appealReportsHost) {
        reports.set(appealNumber, url.toString());
      }
    } catch {
      // Ignore malformed links from the external page.
    }
  }

  return reports;
}

async function getOpenData(): Promise<{
  permits: Permit[];
  fetchedAt: string;
  cityDataUpdatedAt: string | null;
  live: boolean;
}> {
  const [permitsResult, metadataResult, appealReportsResult] = await Promise.allSettled([
    fetchPermits(),
    fetchCityDataUpdatedAt(),
    fetchAppealReportLinks(),
  ]);

  const appealReports =
    appealReportsResult.status === "fulfilled" ? appealReportsResult.value : new Map<string, string>();
  const permits = permitsResult.status === "fulfilled"
    ? permitsResult.value.map((permit) => {
        const appealNumber = normalizeAppealNumber(permit.sdabnumber);
        return {
          ...permit,
          appealreporturl: appealNumber ? appealReports.get(appealNumber) : undefined,
        };
      })
    : [];

  return {
    permits,
    fetchedAt: new Date().toISOString(),
    cityDataUpdatedAt:
      metadataResult.status === "fulfilled" ? metadataResult.value : null,
    live: permitsResult.status === "fulfilled",
  };
}

export default async function Home() {
  const data = await getOpenData();

  return (
    <Dashboard
      {...data}
      config={publicDashboardConfig}
      datasetUrl={cityDataUrls.datasetPage}
      filteredQueryUrl={cityDataUrls.filteredQuery}
    />
  );
}
