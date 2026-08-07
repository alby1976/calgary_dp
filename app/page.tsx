import Dashboard from "./dashboard";
import {
  cityDataUrls,
  dashboardConfig,
  mapSourceRecord,
  publicDashboardConfig,
} from "../lib/dashboard-config";
import type { AppealDecisionRecord, Permit } from "../lib/permit";

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

function sourceText(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : String(value);
}

function mapAppealDecisionRecord(record: Record<string, unknown>): AppealDecisionRecord {
  return {
    year: sourceText(record, "year"),
    appealNumber: sourceText(record, "sdab_no"),
    permitNumber: sourceText(record, "dp_sb_co_no"),
    address: sourceText(record, "address"),
    propertyType: sourceText(record, "property_type"),
    propertyUse: sourceText(record, "property_use"),
    originalDecision: sourceText(record, "da_sa_decision"),
    appealFiledDate: sourceText(record, "date_appeal_filed"),
    initialMeetingDate: sourceText(record, "initial_meeting"),
    finalSessionDate: sourceText(record, "final_session"),
    decisionIssuedDate: sourceText(record, "decision_issued"),
    appealDecision: sourceText(record, "sdab_decision"),
  };
}

async function fetchAppealDecisionRecord(appealNumber: string): Promise<AppealDecisionRecord | null> {
  const url = dashboardConfig.links.decisionRecordApiUrlTemplate.replace(
    "{appealNumber}",
    encodeURIComponent(appealNumber),
  );
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: dashboardConfig.links.appealRefreshSeconds },
    signal: AbortSignal.timeout(dashboardConfig.links.appealRequestTimeoutMilliseconds),
  });

  if (!response.ok) return null;
  const records = (await response.json()) as unknown;
  if (!Array.isArray(records) || !records[0] || typeof records[0] !== "object") return null;
  return mapAppealDecisionRecord(records[0] as Record<string, unknown>);
}

async function fetchAppealDecisionRecords(permits: Permit[]): Promise<Map<string, AppealDecisionRecord>> {
  const appealNumbers = [...new Set(
    permits.map((permit) => normalizeAppealNumber(permit.sdabnumber)).filter(Boolean),
  )] as string[];
  const records = await Promise.allSettled(
    appealNumbers.map(async (appealNumber) => [appealNumber, await fetchAppealDecisionRecord(appealNumber)] as const),
  );
  const result = new Map<string, AppealDecisionRecord>();
  for (const record of records) {
    if (record.status === "fulfilled" && record.value[1]) result.set(record.value[0], record.value[1]);
  }
  return result;
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

  const rawPermits = permitsResult.status === "fulfilled" ? permitsResult.value : [];
  const appealDecisions = rawPermits.length ? await fetchAppealDecisionRecords(rawPermits) : new Map();
  const appealReports =
    appealReportsResult.status === "fulfilled" ? appealReportsResult.value : new Map<string, string>();
  const permits = permitsResult.status === "fulfilled"
    ? rawPermits.map((permit) => {
        const appealNumber = normalizeAppealNumber(permit.sdabnumber);
        return {
          ...permit,
          appealreporturl: appealNumber ? appealReports.get(appealNumber) : undefined,
          appealdecisionrecord: appealNumber ? appealDecisions.get(appealNumber) : undefined,
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
