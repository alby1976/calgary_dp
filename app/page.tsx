import Dashboard, { type Permit } from "./dashboard";

const DATASET_ID = "6933-unw5";
const DATA_URL =
  `https://data.calgary.ca/resource/${DATASET_ID}.geojson?` +
  new URLSearchParams({
    "$where": "upper(communityname)='VARSITY'",
    "$order": "permitnum DESC",
    "$limit": "5000",
  }).toString();

const OPEN_DATA_PAGE =
  "https://data.calgary.ca/Business-and-Economic-Activity/Development-Permits/6933-unw5";
const METADATA_URL =
  `https://data.calgary.ca/api/views/metadata/v1/${DATASET_ID}`;
const ACTIVE_APPEALS_URL =
  "https://www.calgary.ca/content/sdab/en/home/active-appeals.html";
const VARSITY_QUERY_FIELDS = [
  "point", "permitnum", "address", "applicant", "category", "description",
  "proposedusecode", "proposedusedescription", "permitteddiscretionary",
  "landusedistrict", "landusedistrictdescription", "concurrent_loc",
  "statuscurrent", "applieddate", "decisiondate", "releasedate",
  "mustcommencedate", "canceledrefuseddate", "decision", "decisionby",
  "sdabnumber", "sdabhearingdate", "sdabdecision", "sdabdecisiondate",
  "communitycode", "communityname", "ward", "quadrant", "latitude",
  "longitude", "locationcount", "locationtypes", "locationaddresses",
  "locationsgeojson", "locationswkt",
];
const VARSITY_JSON_QUERY_URL =
  "https://data.calgary.ca/api/v3/views/m3bg-37bv/query.json?" +
  new URLSearchParams({
    query:
      `SELECT\n  ${VARSITY_QUERY_FIELDS.map((field) => `\`${field}\``).join(",\n  ")}\n` +
      'WHERE caseless_one_of(`communityname`, "VARSITY")\n' +
      'ORDER BY `permitnum` DESC NULL FIRST',
  }).toString();

type GeoFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Permit;
};

async function fetchPermits(): Promise<Permit[]> {
  const response = await fetch(DATA_URL, {
    headers: { accept: "application/geo+json, application/json" },
    next: { revalidate: 900 },
  });

  if (!response.ok) throw new Error(`Open data returned ${response.status}`);
  const geojson = (await response.json()) as { features?: GeoFeature[] };
  return (geojson.features ?? []).map((feature) => {
    const properties = feature.properties ?? ({} as Permit);
    const coordinates = feature.geometry?.coordinates;
    return {
      ...properties,
      latitude: properties.latitude ?? coordinates?.[1]?.toString(),
      longitude: properties.longitude ?? coordinates?.[0]?.toString(),
    };
  });
}

async function fetchCityDataUpdatedAt(): Promise<string | null> {
  const response = await fetch(METADATA_URL, {
    headers: { accept: "application/json" },
    next: { revalidate: 900 },
  });

  if (!response.ok) return null;
  const metadata = (await response.json()) as { dataUpdatedAt?: string | null };
  return metadata.dataUpdatedAt ?? null;
}

function normalizeAppealNumber(value?: string) {
  return value?.match(/(?:^|\D)(20\d{2}-\d{4})(?:\D|$)/)?.[1] ?? null;
}

async function fetchAppealReportLinks(): Promise<Map<string, string>> {
  const response = await fetch(ACTIVE_APPEALS_URL, {
    headers: { accept: "text/html" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(3500),
  });

  if (!response.ok) return new Map();
  const html = await response.text();
  const reports = new Map<string, string>();
  const reportLink = /<a\b[^>]*\bhref=(["'])([^"']*publicaccess\.calgary\.ca[^"']*)\1[^>]*>/gi;

  for (const match of html.matchAll(reportLink)) {
    const beforeLink = html.slice(Math.max(0, (match.index ?? 0) - 12000), match.index);
    const appealNumbers = beforeLink.match(/\b20\d{2}-\d{4}\b/g);
    const appealNumber = appealNumbers?.at(-1);
    if (!appealNumber) continue;

    const decodedHref = match[2].replaceAll("&amp;", "&").replaceAll("&#38;", "&");
    try {
      const url = new URL(decodedHref, ACTIVE_APPEALS_URL);
      if (url.protocol === "https:" && url.hostname === "publicaccess.calgary.ca") {
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
      datasetUrl={OPEN_DATA_PAGE}
      filteredQueryUrl={VARSITY_JSON_QUERY_URL}
      developmentMapUrl="https://developmentmap.calgary.ca/"
    />
  );
}
