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

type GeoFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Permit;
};

async function getPermits(): Promise<{ permits: Permit[]; fetchedAt: string; live: boolean }> {
  const fetchedAt = new Date().toISOString();

  try {
    const response = await fetch(DATA_URL, {
      headers: { accept: "application/geo+json, application/json" },
      next: { revalidate: 900 },
    });

    if (!response.ok) throw new Error(`Open data returned ${response.status}`);
    const geojson = (await response.json()) as { features?: GeoFeature[] };
    const permits = (geojson.features ?? []).map((feature) => {
      const properties = feature.properties ?? ({} as Permit);
      const coordinates = feature.geometry?.coordinates;
      return {
        ...properties,
        latitude: properties.latitude ?? coordinates?.[1]?.toString(),
        longitude: properties.longitude ?? coordinates?.[0]?.toString(),
      };
    });

    return { permits, fetchedAt, live: true };
  } catch {
    return { permits: [], fetchedAt, live: false };
  }
}

export default async function Home() {
  const data = await getPermits();

  return (
    <Dashboard
      {...data}
      datasetUrl={OPEN_DATA_PAGE}
      developmentMapUrl="https://developmentmap.calgary.ca/"
    />
  );
}
