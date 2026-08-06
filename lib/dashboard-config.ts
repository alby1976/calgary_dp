import rawConfig from "../config/dashboard.json";
import type { Permit } from "./permit";

type Direction = "ASC" | "DESC";

export type DashboardConfig = {
  site: {
    name: string;
    brandMark: string;
    eyebrow: string;
    communityDisplayName: string;
    wardLabel: string;
    cityName: string;
    heroHeading: string;
    heroEmphasis: string;
    description: string;
  };
  feed: {
    baseUrl: string;
    resourceDatasetId: string;
    queryViewId: string;
    datasetPageUrl: string;
    filter: { field: string; value: string };
    order: { field: string; direction: Direction };
    limit: number;
    refreshSeconds: number;
    requestTimeoutMilliseconds: number;
    selectFields: string[];
    fieldMap: Record<keyof typeof PERMIT_FIELD_TARGETS, string>;
  };
  links: {
    developmentMapUrl: string;
    developmentApplicationUrlTemplate: string;
    activeAppealsUrl: string;
    appealReportsHost: string;
    appealRefreshSeconds: number;
    appealRequestTimeoutMilliseconds: number;
  };
  statuses: {
    active: string[];
    approved: string[];
    closed: string[];
  };
  map: {
    fallbackBounds: {
      minLatitude: number;
      maxLatitude: number;
      minLongitude: number;
      maxLongitude: number;
    };
    roadLabels: Array<{ text: string; className: string }>;
  };
};

const PERMIT_FIELD_TARGETS = {
  permitNumber: "permitnum",
  address: "address",
  applicant: "applicant",
  category: "category",
  description: "description",
  proposedUseCode: "proposedusecode",
  proposedUseDescription: "proposedusedescription",
  permittedDiscretionary: "permitteddiscretionary",
  landUseDistrict: "landusedistrict",
  landUseDistrictDescription: "landusedistrictdescription",
  status: "statuscurrent",
  appliedDate: "applieddate",
  decisionDate: "decisiondate",
  releaseDate: "releasedate",
  mustCommenceDate: "mustcommencedate",
  cancelledRefusedDate: "canceledrefuseddate",
  decision: "decision",
  decisionBy: "decisionby",
  appealNumber: "sdabnumber",
  appealHearingDate: "sdabhearingdate",
  appealDecision: "sdabdecision",
  appealDecisionDate: "sdabdecisiondate",
  communityName: "communityname",
  ward: "ward",
  latitude: "latitude",
  longitude: "longitude",
} as const satisfies Record<string, keyof Permit>;

function requireUrl(value: string, label: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return url;
}

function identifier(value: string, label: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${label} is not a valid Socrata field name`);
  }
  return value;
}

function positiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function validateConfig(value: typeof rawConfig): DashboardConfig {
  requireUrl(value.feed.baseUrl, "feed.baseUrl");
  requireUrl(value.feed.datasetPageUrl, "feed.datasetPageUrl");
  requireUrl(value.links.developmentMapUrl, "links.developmentMapUrl");
  requireUrl(
    value.links.developmentApplicationUrlTemplate.replace("{permitNumber}", "DP0000-0000"),
    "links.developmentApplicationUrlTemplate",
  );
  requireUrl(value.links.activeAppealsUrl, "links.activeAppealsUrl");

  if (!value.links.developmentApplicationUrlTemplate.includes("{permitNumber}")) {
    throw new Error("links.developmentApplicationUrlTemplate must contain {permitNumber}");
  }

  identifier(value.feed.filter.field, "feed.filter.field");
  identifier(value.feed.order.field, "feed.order.field");
  value.feed.selectFields.forEach((field) => identifier(field, "feed.selectFields entry"));
  Object.values(value.feed.fieldMap).forEach((field) => identifier(field, "feed.fieldMap value"));
  positiveInteger(value.feed.limit, "feed.limit");
  positiveInteger(value.feed.refreshSeconds, "feed.refreshSeconds");
  positiveInteger(value.feed.requestTimeoutMilliseconds, "feed.requestTimeoutMilliseconds");
  positiveInteger(value.links.appealRefreshSeconds, "links.appealRefreshSeconds");
  positiveInteger(
    value.links.appealRequestTimeoutMilliseconds,
    "links.appealRequestTimeoutMilliseconds",
  );
  if (value.feed.order.direction !== "ASC" && value.feed.order.direction !== "DESC") {
    throw new Error("feed.order.direction must be ASC or DESC");
  }

  for (const key of Object.keys(PERMIT_FIELD_TARGETS) as Array<keyof typeof PERMIT_FIELD_TARGETS>) {
    if (!value.feed.fieldMap[key]) throw new Error(`feed.fieldMap.${key} is required`);
  }

  return value as DashboardConfig;
}

export const dashboardConfig = validateConfig(rawConfig);

const selectFields = [...new Set([
  ...dashboardConfig.feed.selectFields,
  ...Object.values(dashboardConfig.feed.fieldMap),
])];

const escapedFilterValue = dashboardConfig.feed.filter.value.replaceAll("'", "''");
const quotedQueryFilterValue = dashboardConfig.feed.filter.value.replaceAll('"', '\\"');

function urlAt(path: string) {
  return new URL(path, `${dashboardConfig.feed.baseUrl.replace(/\/$/, "")}/`);
}

const dataUrl = urlAt(`resource/${dashboardConfig.feed.resourceDatasetId}.geojson`);
dataUrl.search = new URLSearchParams({
  "$select": selectFields.join(","),
  "$where": `upper(${dashboardConfig.feed.filter.field})='${escapedFilterValue.toUpperCase()}'`,
  "$order": `${dashboardConfig.feed.order.field} ${dashboardConfig.feed.order.direction}`,
  "$limit": String(dashboardConfig.feed.limit),
}).toString();

const metadataUrl = urlAt(`api/views/metadata/v1/${dashboardConfig.feed.resourceDatasetId}`);
const filteredQueryUrl = urlAt(`api/v3/views/${dashboardConfig.feed.queryViewId}/query.json`);
filteredQueryUrl.search = new URLSearchParams({
  query:
    `SELECT\n  ${selectFields.map((field) => `\`${field}\``).join(",\n  ")}\n` +
    `WHERE caseless_one_of(\`${dashboardConfig.feed.filter.field}\`, "${quotedQueryFilterValue}")\n` +
    `ORDER BY \`${dashboardConfig.feed.order.field}\` ${dashboardConfig.feed.order.direction} NULL FIRST`,
}).toString();

export const cityDataUrls = {
  data: dataUrl.toString(),
  metadata: metadataUrl.toString(),
  datasetPage: dashboardConfig.feed.datasetPageUrl,
  filteredQuery: filteredQueryUrl.toString(),
};

function sourceText(record: Record<string, unknown>, sourceField: string) {
  const value = record[sourceField];
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : String(value);
}

export function mapSourceRecord(
  record: Record<string, unknown>,
  coordinates?: [number, number],
): Permit {
  const permit: Permit = {};

  for (const [configKey, targetKey] of Object.entries(PERMIT_FIELD_TARGETS) as Array<
    [keyof typeof PERMIT_FIELD_TARGETS, keyof Permit]
  >) {
    permit[targetKey] = sourceText(record, dashboardConfig.feed.fieldMap[configKey]);
  }

  permit.latitude ??= coordinates?.[1]?.toString();
  permit.longitude ??= coordinates?.[0]?.toString();
  return permit;
}

export const publicDashboardConfig = {
  site: dashboardConfig.site,
  feedScope: {
    filterField: dashboardConfig.feed.filter.field,
    filterValue: dashboardConfig.feed.filter.value,
  },
  links: {
    developmentMapUrl: dashboardConfig.links.developmentMapUrl,
    developmentApplicationUrlTemplate: dashboardConfig.links.developmentApplicationUrlTemplate,
  },
  statuses: dashboardConfig.statuses,
  map: dashboardConfig.map,
};

export type PublicDashboardConfig = typeof publicDashboardConfig;
