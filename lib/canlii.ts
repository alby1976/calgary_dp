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

export function canliiCaseIdForAppeal(appealNumber: string, databaseId: string) {
  const match = normalizeCanliiAppealNumber(appealNumber)?.match(APPEAL_NUMBER);
  if (!match) return null;
  return `${match[1]}${databaseId.toLowerCase()}${Number(match[2])}`;
}

export function canliiMetadataUrl(options: {
  apiBaseUrl: string;
  language: string;
  databaseId: string;
  appealNumber: string;
  apiKey: string;
}) {
  const caseId = canliiCaseIdForAppeal(options.appealNumber, options.databaseId);
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
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const databaseId = optionalText(record, "databaseId");
  const caseId = optionalText(record, "caseId");
  const url = safeDecisionUrl(record.url);
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
