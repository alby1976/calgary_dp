import type { CanliiMetadata } from "./permit";

const APPEAL_NUMBER = /^(20\d{2})-(\d{4})$/;

export function normalizeCanliiAppealNumber(value: string | null | undefined) {
  const match = value?.trim().match(APPEAL_NUMBER);
  return match ? `${match[1]}-${match[2]}` : null;
}

export function normalizeCanliiApiKey(value: string | null | undefined) {
  let apiKey = value?.trim();
  if (!apiKey) return null;

  const assignment = apiKey.match(/^CANLII_API_KEY\s*=\s*(.+)$/i);
  if (assignment) apiKey = assignment[1].trim();

  const hasMatchingQuotes =
    (apiKey.startsWith('"') && apiKey.endsWith('"')) ||
    (apiKey.startsWith("'") && apiKey.endsWith("'"));
  if (hasMatchingQuotes) apiKey = apiKey.slice(1, -1).trim();

  return apiKey || null;
}

export function canliiCaseIdForAppeal(appealNumber: string, caseIdPrefix: string) {
  const match = normalizeCanliiAppealNumber(appealNumber)?.match(APPEAL_NUMBER);
  if (!match) return null;
  return `${match[1]}${caseIdPrefix.toLowerCase()}${Number(match[2])}`;
}

export function canliiMetadataUrl(options: {
  apiBaseUrl: string;
  language: string;
  databaseId: string;
  caseIdPrefix: string;
  appealNumber: string;
  apiKey: string;
}) {
  const caseId = canliiCaseIdForAppeal(options.appealNumber, options.caseIdPrefix);
  if (!caseId) return null;
  const base = options.apiBaseUrl.endsWith("/") ? options.apiBaseUrl : `${options.apiBaseUrl}/`;
  const url = new URL(
    `caseBrowse/${encodeURIComponent(options.language)}/${encodeURIComponent(options.databaseId)}/${encodeURIComponent(caseId)}/`,
    base,
  );
  url.searchParams.set("api_key", options.apiKey);
  return url;
}

function optionalText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalLocalizedText(record: Record<string, unknown>, key: string) {
  const direct = optionalText(record, key);
  if (direct) return direct;

  const value = record[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const localized = value as Record<string, unknown>;
  for (const language of ["en", "fr"]) {
    const candidate = localized[language];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function canliiMetadataRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.cases)) return record;
  const [firstCase] = record.cases;
  return firstCase && typeof firstCase === "object" && !Array.isArray(firstCase)
    ? firstCase as Record<string, unknown>
    : null;
}

function safeDecisionUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isCanliiHost = hostname === "canlii.ca"
      || hostname.endsWith(".canlii.ca")
      || hostname === "canlii.org"
      || hostname.endsWith(".canlii.org");
    if (!isCanliiHost) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeCanliiMetadata(
  payload: unknown,
  expectedDatabaseId: string,
  expectedCaseId: string,
): CanliiMetadata | null {
  const record = canliiMetadataRecord(payload);
  if (!record) return null;
  const databaseId = optionalText(record, "databaseId");
  const caseId = optionalLocalizedText(record, "caseId");
  const url = safeDecisionUrl(optionalLocalizedText(record, "url"));
  const title = optionalText(record, "title");
  const citation = optionalText(record, "citation");

  if (
    databaseId?.toLowerCase() !== expectedDatabaseId.toLowerCase() ||
    caseId?.toLowerCase() !== expectedCaseId.toLowerCase() ||
    !url ||
    !title ||
    !citation
  ) {
    return null;
  }

  return {
    databaseId,
    caseId,
    url,
    title,
    citation,
    language: optionalText(record, "language"),
    docketNumber: optionalText(record, "docketNumber"),
    decisionDate: optionalText(record, "decisionDate"),
    keywords: optionalText(record, "keywords"),
    concatenatedId: optionalText(record, "concatenatedId"),
  };
}

export function summarizeCanliiPayload(payload: unknown) {
  const record = canliiMetadataRecord(payload);
  if (!record) return { shape: Array.isArray(payload) ? "array" : typeof payload };
  const rawUrl = optionalLocalizedText(record, "url");
  let urlHostname: string | null = null;
  try {
    urlHostname = rawUrl ? new URL(rawUrl).hostname : null;
  } catch {
    urlHostname = "invalid";
  }
  return {
    shape: Array.isArray((payload as Record<string, unknown>)?.cases) ? "cases-wrapper" : "record",
    keys: Object.keys(record).sort(),
    databaseId: optionalText(record, "databaseId") ?? null,
    caseId: optionalLocalizedText(record, "caseId") ?? null,
    urlHostname,
    hasTitle: Boolean(optionalText(record, "title")),
    hasCitation: Boolean(optionalText(record, "citation")),
  };
}
