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

async function getOpenData(): Promise<{
  permits: Permit[];
  fetchedAt: string;
  cityDataUpdatedAt: string | null;
  live: boolean;
}> {
  const [permitsResult, metadataResult] = await Promise.allSettled([
    fetchPermits(),
    fetchCityDataUpdatedAt(),
  ]);

  return {
    permits: permitsResult.status === "fulfilled" ? permitsResult.value : [],
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
      developmentMapUrl="https://developmentmap.calgary.ca/"
    />
  );
}
