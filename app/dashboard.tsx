"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicDashboardConfig } from "../lib/dashboard-config";
import type { AppealDecisionRecord, CanliiLookupResponse, Permit } from "../lib/permit";
import PermitMap from "./permit-map";

type Props = {
  permits: Permit[];
  fetchedAt: string;
  cityDataUpdatedAt: string | null;
  live: boolean;
  config: PublicDashboardConfig;
  datasetUrl: string;
  filteredQueryUrl: string;
};

type CanliiUiState = CanliiLookupResponse | { status: "loading" };

type FieldValueMeaning = {
  value: string;
  meaning: string;
};

type MultiSelectFilterProps = {
  label: string;
  values: string[];
  excludedValues: string[];
  onChange: (values: string[]) => void;
  formatValue?: (value: string) => string;
};

type FilterDefaults = {
  query: string;
  excludedYears: string[];
  excludedStatusGroups: string[];
  excludedLandUseDistricts: string[];
  excludedPermittedDiscretionary: string[];
  excludedAppealStatuses: string[];
};

const FILTER_DEFAULTS_STORAGE_KEY = "varsity-development-watch.filter-defaults.v1";
const NOT_REPORTED_FILTER_VALUE = "__not_reported__";

function storedStringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
    : [];
}

function readStoredFilterDefaults(value: string | null): FilterDefaults | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      excludedYears: storedStringArray(parsed.excludedYears),
      excludedStatusGroups: storedStringArray(parsed.excludedStatusGroups),
      excludedLandUseDistricts: storedStringArray(parsed.excludedLandUseDistricts),
      excludedPermittedDiscretionary: storedStringArray(parsed.excludedPermittedDiscretionary),
      excludedAppealStatuses: storedStringArray(parsed.excludedAppealStatuses),
    };
  } catch {
    return null;
  }
}

function toggledExclusions(excludedValues: string[], value: string) {
  return excludedValues.includes(value)
    ? excludedValues.filter((excludedValue) => excludedValue !== value)
    : [...excludedValues, value];
}

function MultiSelectFilter({ label, values, excludedValues, onChange, formatValue = (value) => value }: MultiSelectFilterProps) {
  const excluded = new Set(excludedValues);
  const selectedCount = values.filter((value) => !excluded.has(value)).length;
  const selectionSummary = selectedCount === values.length
    ? `All ${values.length} selected`
    : selectedCount === 0
      ? "None selected"
      : `${selectedCount} of ${values.length} selected`;

  function toggleValue(value: string) {
    onChange(excluded.has(value)
      ? excludedValues.filter((excludedValue) => excludedValue !== value)
      : [...excludedValues, value]);
  }

  return (
    <details className="multi-select-filter">
      <summary aria-label={`${label}: ${selectionSummary}`}>
        <span>{label}</span>
        <small>{selectionSummary}</small>
      </summary>
      <div className="multi-select-filter-panel">
        <div className="multi-select-actions">
          <button type="button" onClick={() => onChange([])} disabled={selectedCount === values.length}>Select all</button>
          <button type="button" onClick={() => onChange([...values])} disabled={selectedCount === 0}>Deselect all</button>
        </div>
        <fieldset>
          <legend className="sr-only">{label} values to show</legend>
          {values.map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={!excluded.has(value)}
                onChange={() => toggleValue(value)}
              />
              <span>{formatValue(value)}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}

function text(value?: string) {
  return value?.trim() || "Not reported";
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Edmonton",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Edmonton",
    timeZoneName: "short",
  }).format(date);
}

function yearOf(value?: string) {
  if (!value) return "Unknown";
  const year = new Date(value).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : "Unknown";
}

const STATUS_GUIDES = {
  active: {
    label: "Active / under review",
    meaning: "Still moving through the City process.",
    detail: "It may be newly submitted, under review, circulating, awaiting revisions or involved in an appeal. Check the plans, deadlines and assigned planner.",
  },
  approved: {
    label: "Approved / released",
    meaning: "The City said yes—check which stage.",
    detail: "Approved may still involve conditions or an appeal period. Released is a later step. Green does not mean construction has started or finished.",
  },
  closed: {
    label: "Refused / cancelled",
    meaning: "Stopped in its current form.",
    detail: "The permit may be refused, cancelled, expired or lapsed. It could still be appealed, revised or submitted again.",
  },
  other: {
    label: "Other status",
    meaning: "Read the exact City status before drawing a conclusion.",
    detail: "The status may be missing, unusual or new, or may not fit the dashboard's main groups. Grey does not automatically mean inactive.",
  },
} as const;

type StatusGuideGroup = keyof typeof STATUS_GUIDES;

const STATUS_FILTER_VALUES = Object.keys(STATUS_GUIDES) as StatusGuideGroup[];
const APPEAL_FILTER_VALUES = ["appealed", "not-appealed"];

function dataFilterValueLabel(value: string) {
  if (value === NOT_REPORTED_FILTER_VALUE) return "Not reported";
  return value;
}

function statusFilterValueLabel(value: string) {
  return STATUS_GUIDES[value as StatusGuideGroup]?.label ?? value;
}

function appealStatusFilterValueLabel(value: string) {
  if (value === "appealed") return "Appealed to SDAB";
  if (value === "not-appealed") return "No SDAB appeal recorded";
  return value;
}

function statusGroup(status: string | undefined, keywords: PublicDashboardConfig["statuses"]): StatusGuideGroup {
  const value = (status ?? "unknown").toLowerCase();
  if (keywords.active.some((word) => value.includes(word.toLowerCase()))) return "active";
  if (keywords.approved.some((word) => value.includes(word.toLowerCase()))) return "approved";
  if (keywords.closed.some((word) => value.includes(word.toLowerCase()))) return "closed";
  return "other";
}

function permitYear(permit: Permit) {
  const match = permit.permitnum?.match(/(?:DP)?(19|20)\d{2}/i);
  return match ? match[0].replace(/^DP/i, "") : yearOf(permit.applieddate);
}

function landUseDistrictValues(permit: Permit) {
  return (permit.landusedistrict ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
}

function landUseDistrictFilterValues(permit: Permit) {
  const values = landUseDistrictValues(permit);
  return values.length ? values : [NOT_REPORTED_FILTER_VALUE];
}

function semicolonValues(value?: string) {
  return (value ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function districtModifierMeaning(district: string) {
  const meanings: string[] = [];
  const density = district.match(/d(\d+(?:\.\d+)?)/i)?.[1];
  const floorAreaRatio = district.match(/f(\d+(?:\.\d+)?)/i)?.[1];
  const height = district.match(/h(\d+(?:\.\d+)?)/i)?.[1];

  if (density) meanings.push(`d${density} sets the maximum density at ${density} units per hectare`);
  if (floorAreaRatio) meanings.push(`f${floorAreaRatio} sets the maximum floor-area ratio at ${floorAreaRatio}`);
  if (height) meanings.push(`h${height} sets the maximum building height at ${height} metres`);
  return meanings.length ? ` The modifiers mean: ${meanings.join("; ")}.` : "";
}

function landUseDistrictValueMeanings(permits: Permit[]): FieldValueMeaning[] {
  const descriptionsByDistrict = new Map<string, Map<string, string>>();

  for (const permit of permits) {
    const districts = landUseDistrictValues(permit);
    const descriptions = semicolonValues(permit.landusedistrictdescription);
    districts.forEach((district, index) => {
      const description = descriptions[index];
      if (!descriptionsByDistrict.has(district)) descriptionsByDistrict.set(district, new Map());
      if (description) {
        descriptionsByDistrict.get(district)?.set(description.toLocaleLowerCase("en-CA"), description);
      }
    });
  }

  return [...descriptionsByDistrict.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en-CA", { numeric: true }))
    .map(([district, descriptions]) => {
      const publishedDescriptions = [...descriptions.values()];
      const description = publishedDescriptions.length
        ? `The City dataset describes this as ${publishedDescriptions.map((value) => `“${value}”`).join(" or ")}.`
        : "The City dataset does not provide a description for this value.";
      const directControl = district.toUpperCase() === "DC"
        ? " Direct Control rules are site-specific, so the applicable Direct Control bylaw must be checked."
        : "";
      return {
        value: district,
        meaning: `${description}${directControl}${districtModifierMeaning(district)}`,
      };
    });
}

const CURRENT_STATUS_MEANINGS: Record<string, string> = {
  "new": "The application has recently entered the City's system. This is not a decision.",
  "under review": "City staff are assessing the application. No final decision is recorded yet.",
  "in circulation": "The application has been sent to relevant City teams or other reviewers for comments. This is not a decision.",
  "in advertising": "The City is publishing notice of the application or decision. Check the official file for the notice dates and any appeal deadline.",
  "pending decision": "Review is still underway and the dataset does not yet record a final decision.",
  "pending release": "A decision has been made, but the permit has not yet been released. Requirements, conditions or an appeal period may still remain.",
  "pending appeal": "The application or decision is awaiting an appeal step or outcome. The official SDAB file controls the result and dates.",
  "approved": "A favourable decision is recorded, but the permit may still need to complete conditions or an appeal period before release.",
  "released": "The permit has been released after the applicable processing steps. This does not mean construction has started or finished.",
  "refused": "The application was refused. Appeal rights and deadlines may apply; check the official decision.",
  "cancelled": "The application was cancelled or closed without a released permit. Check the official file for the reason.",
  "cancelled - pending refund": "The application was cancelled and the related refund process was still outstanding when the status was published.",
  "expired": "The City records the application or permit as expired. Do not assume that it still authorizes development.",
  "lapsed": "The application or approval is no longer active after a required step or deadline was not completed. Check the official file for the exact cause.",
  "inactive": "The file is no longer active in the current workflow. The dataset does not explain the reason, so check the official file.",
};

function currentStatusValueMeanings(permits: Permit[]): FieldValueMeaning[] {
  return [...new Set(permits.map((permit) => permit.statuscurrent?.trim()).filter(Boolean) as string[])]
    .sort((a, b) => a.localeCompare(b, "en-CA"))
    .map((value) => ({
      value,
      meaning: CURRENT_STATUS_MEANINGS[value.toLocaleLowerCase("en-CA")]
        ?? "This is the exact status currently published by the City. Its detailed meaning is not documented in the dataset, so check the official application before relying on it.",
    }));
}

const PERMITTED_DISCRETIONARY_MEANINGS: Record<string, string> = {
  "permitted": "The proposed use is listed as permitted in the applicable land-use district. If it meets every relevant bylaw rule, the Development Authority must approve it.",
  "permitted with a relaxation": "The proposed use is permitted, but part of the proposal does not meet one or more bylaw rules. The requested relaxation is reviewed case by case and is not automatically approved.",
  "discretionary": "The proposed use is listed as discretionary in the district. The City may consider planning policy, site conditions, compatibility, access, parking, servicing and public feedback before approving or refusing it.",
  "unspecified": "The City dataset does not specify the classification for this record. It does not mean that the use is automatically permitted or exempt from review.",
};

function permittedDiscretionaryValueMeanings(permits: Permit[]): FieldValueMeaning[] {
  return [...new Set(permits.map(permittedDiscretionaryValue).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en-CA"))
    .map((value) => ({
      value,
      meaning: PERMITTED_DISCRETIONARY_MEANINGS[value.toLocaleLowerCase("en-CA")]
        ?? "This is the exact classification currently published by the City. Check the applicable land-use district and official application for its legal meaning.",
    }));
}

function permittedDiscretionaryValue(permit: Permit) {
  return permit.permitteddiscretionary?.trim() ?? "";
}

function permittedDiscretionaryFilterValue(permit: Permit) {
  return permittedDiscretionaryValue(permit) || NOT_REPORTED_FILTER_VALUE;
}

function appealFilterValue(permit: Permit) {
  return permit.sdabnumber?.trim() ? "appealed" : "not-appealed";
}

function developmentMapApplicationUrl(permitNumber: string | undefined, template: string) {
  const normalized = permitNumber?.trim().toUpperCase();
  if (!normalized || !/^DP\d{4}-\d+$/.test(normalized)) return null;
  return template.replace("{permitNumber}", encodeURIComponent(normalized));
}

function normalizedAppealNumber(value: string | undefined) {
  return value?.match(/(?:^|\D)(20\d{2}-\d{4})(?:\D|$)/)?.[1] ?? null;
}

function decisionRecordUrl(appealNumber: string | null, template: string) {
  if (!appealNumber) return null;
  return template.replace("{appealNumber}", encodeURIComponent(appealNumber));
}

function canliiCitation(appealNumber: string | null) {
  const match = appealNumber?.match(/^(20\d{2})-(\d{4})$/);
  if (!match) return null;
  return `${match[1]} CGYSDAB ${Number(match[2])}`;
}

function canliiDecisionSearchUrl(citation: string | null, template: string) {
  if (!citation) return null;
  return template.replace("{citation}", encodeURIComponent(citation));
}

function appealOutcomeMeaning(value?: string) {
  const outcome = value?.trim().toUpperCase() ?? "";
  if (outcome.includes("WITHDRAWN")) {
    return "The appeal was ended before the Board made a final ruling on it. Check the official file to confirm what decision remains in effect.";
  }
  if (outcome.includes("ALLOWED IN PART")) {
    return "The Board accepted part of the appeal and changed only part of the original decision. The written decision explains exactly what changed.";
  }
  if (outcome.includes("ALLOWED")) {
    return "The Board granted the appeal and changed or replaced the original decision. Conditions may still apply.";
  }
  if (outcome.includes("DENIED") || outcome.includes("DISMISSED")) {
    return "The Board did not grant the appeal. The original decision generally remains, but the official written decision controls.";
  }
  return "This is the outcome wording published by Calgary. Read the official decision before relying on it for deadlines, conditions or legal meaning.";
}

function StatusDot({ group }: { group: string }) {
  return <span className={`status-dot status-${group}`} aria-hidden="true" />;
}

const PERMIT_FIELD_DEFINITIONS = [
  {
    id: "proposed-use",
    label: "Proposed use",
    definition: "The City-published description of what the application proposes to build, operate or change. It does not mean the proposal has been approved.",
  },
  {
    id: "permitted-discretionary",
    label: "Permitted / discretionary",
    definition: "How the proposed use is classified under the applicable land-use district. A permitted use generally must meet the district rules; a discretionary use requires planning judgment and may involve notice or additional conditions. The Land Use Bylaw and official file control.",
  },
  {
    id: "land-use-district",
    label: "Land-use district",
    definition: "The zoning designation and development rules the City applies to the property. A record may list more than one district.",
  },
  {
    id: "concurrent-redesignation",
    label: "Concurrent land-use redesignation",
    definition: "A related application to change the property's land-use district while the development permit is being considered. The value is normally the related City file number.",
  },
  {
    id: "current-status",
    label: "Current status",
    definition: "The latest processing stage published in the City dataset, such as under review, approved, released, refused or cancelled. Read the exact City wording before drawing a conclusion.",
  },
  {
    id: "applied-date",
    label: "Applied date",
    definition: "The date the City records the development-permit application as received.",
  },
  {
    id: "decision",
    label: "Decision",
    definition: "The City's recorded result for the application, such as approved or refused. Conditions, appeal rights and legal effect come from the official decision and permit.",
  },
  {
    id: "decision-date",
    label: "Decision date",
    definition: "The date the City records the development-permit decision as made.",
  },
  {
    id: "released-date",
    label: "Released date",
    definition: "The date the City records the permit as released after applicable review steps or conditions. It is not necessarily the date construction started.",
  },
  {
    id: "must-commence-date",
    label: "Must commence date",
    definition: "The recorded deadline for beginning the approved development before the permit may lapse. Verify the controlling date and conditions on the official permit.",
  },
  {
    id: "decision-by",
    label: "Decision by",
    definition: "The City authority, role or decision-making body recorded as responsible for the permit decision.",
  },
  {
    id: "sdab-number",
    label: "SDAB number",
    definition: "The tracking number assigned by Calgary's Subdivision and Development Appeal Board. It is different from the development-permit number.",
  },
  {
    id: "sdab-decision",
    label: "SDAB decision",
    definition: "The Board's published appeal outcome. The complete written decision controls the conditions, reasons and legal effect.",
  },
] as const;

function FieldTerm({
  label,
  definitionId,
  onExplain,
}: {
  label: string;
  definitionId: string;
  onExplain: (definitionId: string) => void;
}) {
  return (
    <dt className="field-term">
      <span>{label}</span>
      <button
        type="button"
        className="field-help-button"
        aria-label={`Explain ${label}`}
        aria-controls="permit-field-guide"
        onClick={() => onExplain(definitionId)}
      >
        <span aria-hidden="true">?</span>
      </button>
    </dt>
  );
}

type PlottedPermit = {
  permit: Permit;
  lat: number;
  lon: number;
  group: StatusGuideGroup;
};

function parseCoordinate(value: string | undefined, minimum: number, maximum: number) {
  if (!value?.trim()) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export default function Dashboard({ permits, fetchedAt, cityDataUpdatedAt, live, config, datasetUrl, filteredQueryUrl }: Props) {
  const [query, setQuery] = useState("");
  const [excludedYears, setExcludedYears] = useState<string[]>([]);
  const [excludedStatusGroups, setExcludedStatusGroups] = useState<string[]>([]);
  const [excludedLandUseDistricts, setExcludedLandUseDistricts] = useState<string[]>([]);
  const [excludedPermittedDiscretionary, setExcludedPermittedDiscretionary] = useState<string[]>([]);
  const [excludedAppealStatuses, setExcludedAppealStatuses] = useState<string[]>([]);
  const [savedFilterDefaults, setSavedFilterDefaults] = useState<FilterDefaults | null>(null);
  const [filterDefaultsMessage, setFilterDefaultsMessage] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [fieldGuideQuery, setFieldGuideQuery] = useState("");
  const [hoveredGuide, setHoveredGuide] = useState<StatusGuideGroup | null>(null);
  const [canliiLookups, setCanliiLookups] = useState<Record<string, CanliiUiState>>({});
  const requestedCanliiAppeals = useRef(new Set<string>());
  const filterToggleButton = useRef<HTMLButtonElement | null>(null);
  const selectedExplorerRow = useRef<HTMLButtonElement | null>(null);
  const permitFieldGuide = useRef<HTMLDetailsElement | null>(null);
  const groupFor = (status?: string) => statusGroup(status, config.statuses);

  const years = useMemo(
    () => [...new Set(permits.map(permitYear))].sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return b.localeCompare(a);
    }),
    [permits],
  );

  const landUseDistricts = useMemo(
    () => [...new Set(permits.flatMap(landUseDistrictFilterValues))]
      .sort((a, b) => {
        if (a === NOT_REPORTED_FILTER_VALUE) return 1;
        if (b === NOT_REPORTED_FILTER_VALUE) return -1;
        return a.localeCompare(b, "en-CA", { numeric: true });
      }),
    [permits],
  );

  const permittedDiscretionaryValues = useMemo(
    () => [...new Set(permits.map(permittedDiscretionaryFilterValue))]
      .sort((a, b) => {
        if (a === NOT_REPORTED_FILTER_VALUE) return 1;
        if (b === NOT_REPORTED_FILTER_VALUE) return -1;
        return a.localeCompare(b, "en-CA");
      }),
    [permits],
  );

  const fieldValueMeanings = useMemo<Record<string, FieldValueMeaning[]>>(() => ({
    "land-use-district": landUseDistrictValueMeanings(permits),
    "current-status": currentStatusValueMeanings(permits),
    "permitted-discretionary": permittedDiscretionaryValueMeanings(permits),
  }), [permits]);

  const grouped = useMemo(() => {
    const counts = { active: 0, approved: 0, closed: 0, other: 0 };
    permits.forEach((permit) => counts[statusGroup(permit.statuscurrent, config.statuses)]++);
    return counts;
  }, [permits, config.statuses]);

  useEffect(() => {
    let stored: FilterDefaults | null = null;
    try {
      stored = readStoredFilterDefaults(window.localStorage.getItem(FILTER_DEFAULTS_STORAGE_KEY));
    } catch {
      return;
    }
    if (!stored) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || !stored) return;
      setQuery(stored.query);
      setExcludedYears(stored.excludedYears);
      setExcludedStatusGroups(stored.excludedStatusGroups);
      setExcludedLandUseDistricts(stored.excludedLandUseDistricts);
      setExcludedPermittedDiscretionary(stored.excludedPermittedDiscretionary);
      setExcludedAppealStatuses(stored.excludedAppealStatuses);
      setSavedFilterDefaults(stored);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!filterDrawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFilterDrawerOpen(false);
      window.requestAnimationFrame(() => filterToggleButton.current?.focus());
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filterDrawerOpen]);

  const currentFilterDefaults = useMemo<FilterDefaults>(() => ({
    query,
    excludedYears,
    excludedStatusGroups,
    excludedLandUseDistricts,
    excludedPermittedDiscretionary,
    excludedAppealStatuses,
  }), [
    query,
    excludedYears,
    excludedStatusGroups,
    excludedLandUseDistricts,
    excludedPermittedDiscretionary,
    excludedAppealStatuses,
  ]);
  const hasActiveFilters = Boolean(
    query
    || excludedYears.length
    || excludedStatusGroups.length
    || excludedLandUseDistricts.length
    || excludedPermittedDiscretionary.length
    || excludedAppealStatuses.length,
  );
  const activeFilterCategoryCount = [
    excludedYears,
    excludedStatusGroups,
    excludedLandUseDistricts,
    excludedPermittedDiscretionary,
    excludedAppealStatuses,
  ].filter((values) => values.length > 0).length;
  const savedDefaultMatchesCurrent = Boolean(
    savedFilterDefaults
    && JSON.stringify(savedFilterDefaults) === JSON.stringify(currentFilterDefaults),
  );

  function applyFilterDefaults(defaults: FilterDefaults) {
    setQuery(defaults.query);
    setExcludedYears(defaults.excludedYears);
    setExcludedStatusGroups(defaults.excludedStatusGroups);
    setExcludedLandUseDistricts(defaults.excludedLandUseDistricts);
    setExcludedPermittedDiscretionary(defaults.excludedPermittedDiscretionary);
    setExcludedAppealStatuses(defaults.excludedAppealStatuses);
    setShowAll(false);
  }

  function saveCurrentFiltersAsDefault() {
    try {
      window.localStorage.setItem(FILTER_DEFAULTS_STORAGE_KEY, JSON.stringify(currentFilterDefaults));
      setSavedFilterDefaults(currentFilterDefaults);
      setFilterDefaultsMessage("Current filters saved as this browser's default.");
    } catch {
      setFilterDefaultsMessage("This browser could not save the filter default.");
    }
  }

  function removeSavedFilterDefault() {
    try {
      window.localStorage.removeItem(FILTER_DEFAULTS_STORAGE_KEY);
      setSavedFilterDefaults(null);
      setFilterDefaultsMessage("Saved filter default removed from this browser.");
    } catch {
      setFilterDefaultsMessage("This browser could not remove the saved filter default.");
    }
  }

  function clearCurrentFilters() {
    applyFilterDefaults({
      query: "",
      excludedYears: [],
      excludedStatusGroups: [],
      excludedLandUseDistricts: [],
      excludedPermittedDiscretionary: [],
      excludedAppealStatuses: [],
    });
    setFilterDefaultsMessage("");
  }

  function closeFilterDrawer() {
    setFilterDrawerOpen(false);
    window.requestAnimationFrame(() => filterToggleButton.current?.focus());
  }

  const excludedYearSet = useMemo(() => new Set(excludedYears), [excludedYears]);
  const excludedStatusGroupSet = useMemo(() => new Set(excludedStatusGroups), [excludedStatusGroups]);
  const excludedLandUseDistrictSet = useMemo(
    () => new Set(excludedLandUseDistricts),
    [excludedLandUseDistricts],
  );
  const excludedPermittedDiscretionarySet = useMemo(
    () => new Set(excludedPermittedDiscretionary),
    [excludedPermittedDiscretionary],
  );
  const excludedAppealStatusSet = useMemo(
    () => new Set(excludedAppealStatuses),
    [excludedAppealStatuses],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return permits.filter((permit) => {
      const matchesGroup = !excludedStatusGroupSet.has(statusGroup(permit.statuscurrent, config.statuses));
      const matchesYear = !excludedYearSet.has(permitYear(permit));
      const matchesLandUseDistrict = landUseDistrictFilterValues(permit)
        .every((value) => !excludedLandUseDistrictSet.has(value));
      const matchesPermittedDiscretionary = !excludedPermittedDiscretionarySet
        .has(permittedDiscretionaryFilterValue(permit));
      const matchesAppeal = !excludedAppealStatusSet.has(appealFilterValue(permit));
      const haystack = [
        permit.permitnum,
        permit.address,
        permit.description,
        permit.applicant,
        permit.proposedusedescription,
        permit.permitteddiscretionary,
        permit.landusedistrict,
        permit.concurrent_loc,
        permit.statuscurrent,
        permit.decision,
        permit.sdabnumber,
        permit.sdabdecision,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesGroup
        && matchesYear
        && matchesLandUseDistrict
        && matchesPermittedDiscretionary
        && matchesAppeal
        && (!needle || haystack.includes(needle));
    });
  }, [
    permits,
    query,
    excludedStatusGroupSet,
    excludedYearSet,
    excludedLandUseDistrictSet,
    excludedPermittedDiscretionarySet,
    excludedAppealStatusSet,
    config.statuses,
  ]);

  const recent = useMemo(
    () => [...filtered].sort((a, b) => (b.applieddate ?? "").localeCompare(a.applieddate ?? "")),
    [filtered],
  );
  const latest = recent.slice(0, 12);
  const selectedPermit = recent.find((permit) => permit.permitnum === selected) ?? latest[0];
  const selectedOutsideLatest = Boolean(
    selected
    && selectedPermit?.permitnum === selected
    && !latest.some((permit) => permit.permitnum === selected),
  );
  const displayed = showAll
    ? recent
    : selectedOutsideLatest && selectedPermit
      ? [selectedPermit, ...latest]
      : latest;
  const selectedApplicationUrl = developmentMapApplicationUrl(
    selectedPermit?.permitnum,
    config.links.developmentApplicationUrlTemplate,
  );
  const selectedAppealNumber = normalizedAppealNumber(selectedPermit?.sdabnumber);
  const selectedDecisionRecordUrl = decisionRecordUrl(
    selectedAppealNumber,
    config.links.decisionRecordPageUrlTemplate,
  );
  const selectedDecisionJsonUrl = decisionRecordUrl(
    selectedAppealNumber,
    config.links.decisionRecordApiUrlTemplate,
  );
  const selectedCanliiCitation = canliiCitation(selectedAppealNumber);
  const selectedCanliiUrl = canliiDecisionSearchUrl(
    selectedCanliiCitation,
    config.links.canliiDecisionSearchUrlTemplate,
  );
  const selectedCanliiLookup = selectedAppealNumber ? canliiLookups[selectedAppealNumber] : undefined;
  const selectedAppealRecord: AppealDecisionRecord | null = selectedPermit && selectedAppealNumber
    ? selectedPermit.appealdecisionrecord ?? {
        appealNumber: selectedAppealNumber,
        permitNumber: selectedPermit.permitnum,
        address: selectedPermit.address,
        propertyType: selectedPermit.category,
        propertyUse: selectedPermit.proposedusedescription ?? selectedPermit.description,
        originalDecision: selectedPermit.decision,
        initialMeetingDate: selectedPermit.sdabhearingdate,
        decisionIssuedDate: selectedPermit.sdabdecisiondate,
        appealDecision: selectedPermit.sdabdecision,
      }
    : null;
  const selectedAppealRecordIsSdab = Boolean(selectedPermit?.appealdecisionrecord);
  const selectedAppealIsDecided = Boolean(
    selectedPermit?.sdabdecisiondate?.trim() || selectedPermit?.sdabdecision?.trim(),
  );
  const visiblePermitFieldDefinitions = useMemo(() => {
    const needle = fieldGuideQuery.trim().toLowerCase();
    return PERMIT_FIELD_DEFINITIONS.flatMap(({ id, label, definition }) => {
      const values = fieldValueMeanings[id] ?? [];
      if (!needle) return [{ id, label, definition, values }];
      const definitionMatches = `${label} ${definition}`.toLowerCase().includes(needle);
      const matchingValues = values.filter(({ value, meaning }) => (
        `${value} ${meaning}`.toLowerCase().includes(needle)
      ));
      return definitionMatches || matchingValues.length
        ? [{ id, label, definition, values: definitionMatches ? values : matchingValues }]
        : [];
    });
  }, [fieldGuideQuery, fieldValueMeanings]);

  const revealPermitFieldDefinition = (definitionId: string) => {
    setFieldGuideQuery("");
    if (permitFieldGuide.current) permitFieldGuide.current.open = true;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const definition = document.getElementById(`permit-field-definition-${definitionId}`);
        const valueGlossary = definition?.querySelector("details");
        if (valueGlossary instanceof HTMLDetailsElement) valueGlossary.open = true;
        definition?.focus();
      });
    });
  };

  useEffect(() => {
    if (!selected) return;
    selectedExplorerRow.current?.scrollIntoView({ block: "nearest" });
  }, [selected, showAll, selectedOutsideLatest]);

  useEffect(() => {
    if (!selectedAppealNumber || requestedCanliiAppeals.current.has(selectedAppealNumber)) return;

    const appealNumber = selectedAppealNumber;
    requestedCanliiAppeals.current.add(appealNumber);
    setCanliiLookups((current) => ({ ...current, [appealNumber]: { status: "loading" } }));

    fetch(`/api/canlii-metadata?appeal=${encodeURIComponent(appealNumber)}`, {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("CanLII metadata endpoint failed");
        return response.json() as Promise<CanliiLookupResponse>;
      })
      .then((result) => {
        setCanliiLookups((current) => ({ ...current, [appealNumber]: result }));
      })
      .catch((error: unknown) => {
        void error;
        setCanliiLookups((current) => ({ ...current, [appealNumber]: { status: "unavailable" } }));
      });
  }, [selectedAppealNumber]);

  const chartYears = years.slice(0, 8).reverse();
  const yearCounts = chartYears.map((value) => ({
    year: value,
    count: permits.filter((permit) => permitYear(permit) === value).length,
  }));
  const maxYearCount = Math.max(1, ...yearCounts.map((item) => item.count));

  const plotted = useMemo<PlottedPermit[]>(() => filtered
    .map((permit) => {
      // Blank strings become zero with Number(""), which can pull fitBounds to
      // the Gulf of Guinea and make every real Calgary point look absent.
      const lat = parseCoordinate(
        permit.latitude,
        config.map.fallbackBounds.minLatitude - 0.5,
        config.map.fallbackBounds.maxLatitude + 0.5,
      );
      const lon = parseCoordinate(
        permit.longitude,
        config.map.fallbackBounds.minLongitude - 0.5,
        config.map.fallbackBounds.maxLongitude + 0.5,
      );

      return lat === null || lon === null ? null : {
        permit,
        lat,
        lon,
        group: statusGroup(permit.statuscurrent, config.statuses),
      };
    })
    .filter((item): item is PlottedPermit => item !== null), [filtered, config.map.fallbackBounds, config.statuses]);
  return (
    <main>
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true"><span>{config.site.brandMark}</span></div>
        <div>
          <p className="eyebrow">{config.site.eyebrow}</p>
          <p className="brand-name">{config.site.name}</p>
        </div>
        <div className={`data-state ${live ? "is-live" : "is-offline"}`}>
          <span /> {live ? "City feed connected" : "City feed unavailable"}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">
            {[config.site.communityDisplayName, config.site.wardLabel, config.site.cityName].filter(Boolean).join(" · ")}
          </p>
          <h1>{config.site.heroHeading}<br /><em>{config.site.heroEmphasis}</em></h1>
          <p className="hero-lede">{config.site.description}</p>
          <div className="hero-actions">
            <a href="#permit-explorer" className="primary-action">Explore permits <span>↓</span></a>
            <a href={datasetUrl} target="_blank" rel="noreferrer" className="text-action">View official source ↗</a>
          </div>
        </div>
        <div className="hero-aside">
          <p className="aside-label">Open-data snapshot</p>
          <p className="big-number">{permits.length.toLocaleString("en-CA")}</p>
          <p className="big-number-label">{config.site.communityDisplayName} permits in the feed</p>
          <div className="freshness-list">
            <div className="freshness">
              <span>City data updated</span>
              <strong>{formatDateTime(cityDataUpdatedAt)}</strong>
            </div>
            <div className="freshness">
              <span>Dashboard refreshed</span>
              <strong>{formatDateTime(fetchedAt)}</strong>
            </div>
          </div>
          <p className="caveat">This is a public-interest interpretation of municipal open data—not an official City notice.</p>
        </div>
      </section>

      {!live && (
        <div className="feed-warning" role="status">
          The City feed could not be reached. Counts and permit records will appear automatically when it reconnects.
        </div>
      )}

      <section className="signal-strip" aria-label="Permit status summary">
        {[
          { key: "active", label: "Active / under review", count: grouped.active },
          { key: "approved", label: "Approved / released", count: grouped.approved },
          { key: "closed", label: "Refused / cancelled", count: grouped.closed },
          { key: "other", label: "Other status", count: grouped.other },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            className={excludedStatusGroupSet.has(key) ? "signal excluded-filter" : "signal"}
            aria-pressed={!excludedStatusGroupSet.has(key)}
            aria-label={`${label}: ${count.toLocaleString("en-CA")} permits; ${excludedStatusGroupSet.has(key) ? "show status" : "hide status"}`}
            onClick={() => setExcludedStatusGroups(toggledExclusions(excludedStatusGroups, key))}
          >
            <StatusDot group={key} />
            <span><strong>{count.toLocaleString("en-CA")}</strong>{label}</span>
          </button>
        ))}
      </section>

      <section className="linked-map-grid" aria-label="Linked permit exploration workspace">
        <aside id="permit-explorer" className="explorer workspace-explorer" aria-label="Permit explorer and filters">
          <div className="explorer-heading">
            <div><p className="eyebrow">Find and select</p><h2>Permit explorer</h2></div>
            <p>{filtered.length.toLocaleString("en-CA")} matches</p>
          </div>
          <div className="filter-toolbar">
            <label className="search-field filter-search-field">
              <span className="sr-only">Search permits</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permits or addresses…" />
            </label>
            <button
              ref={filterToggleButton}
              className="filter-drawer-toggle"
              type="button"
              aria-expanded={filterDrawerOpen}
              aria-controls="permit-filter-drawer"
              onClick={() => setFilterDrawerOpen(true)}
            >
              Filters
              {activeFilterCategoryCount > 0 && <strong aria-label={`${activeFilterCategoryCount} active filter categories`}>{activeFilterCategoryCount}</strong>}
            </button>
            {hasActiveFilters && (
              <button className="clear-button" type="button" onClick={clearCurrentFilters}>
                Clear
              </button>
            )}
          </div>
          {activeFilterCategoryCount > 0 && (
            <div className="active-filter-chips" aria-label="Active filter categories">
              {excludedYears.length > 0 && (
                <button type="button" onClick={() => setExcludedYears([])} aria-label="Show all years">
                  Years: {excludedYears.length} hidden <span aria-hidden="true">×</span>
                </button>
              )}
              {excludedStatusGroups.length > 0 && (
                <button type="button" onClick={() => setExcludedStatusGroups([])} aria-label="Show all permit statuses">
                  Statuses: {excludedStatusGroups.length} hidden <span aria-hidden="true">×</span>
                </button>
              )}
              {excludedLandUseDistricts.length > 0 && (
                <button type="button" onClick={() => setExcludedLandUseDistricts([])} aria-label="Show all land-use districts">
                  Districts: {excludedLandUseDistricts.length} hidden <span aria-hidden="true">×</span>
                </button>
              )}
              {excludedPermittedDiscretionary.length > 0 && (
                <button type="button" onClick={() => setExcludedPermittedDiscretionary([])} aria-label="Show all permitted and discretionary values">
                  Permit type: {excludedPermittedDiscretionary.length} hidden <span aria-hidden="true">×</span>
                </button>
              )}
              {excludedAppealStatuses.length > 0 && (
                <button type="button" onClick={() => setExcludedAppealStatuses([])} aria-label="Show all appeal statuses">
                  Appeals: {excludedAppealStatuses.length} hidden <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}
          <p className="filter-default-status" role="status" aria-live="polite">{filterDefaultsMessage}</p>
          {filterDrawerOpen && (
            <div className="filter-drawer-backdrop" role="presentation" onMouseDown={closeFilterDrawer}>
              <section
                id="permit-filter-drawer"
                className="filter-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="permit-filter-drawer-title"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="filter-drawer-header">
                  <div>
                    <p className="eyebrow">Choose what to show</p>
                    <h2 id="permit-filter-drawer-title">Table and map filters</h2>
                  </div>
                  <button type="button" className="filter-drawer-close" onClick={closeFilterDrawer} autoFocus aria-label="Close filters">×</button>
                </div>
                <div className="filter-drawer-body">
                  <p className="filter-drawer-intro">Changes update the table and both maps immediately.</p>
                  <div className="filters filter-drawer-controls">
                    <MultiSelectFilter
                      label="Years"
                      values={years}
                      excludedValues={excludedYears}
                      onChange={setExcludedYears}
                    />
                    <MultiSelectFilter
                      label="Permit statuses"
                      values={STATUS_FILTER_VALUES}
                      excludedValues={excludedStatusGroups}
                      onChange={setExcludedStatusGroups}
                      formatValue={statusFilterValueLabel}
                    />
                    <MultiSelectFilter
                      label="Land-use districts"
                      values={landUseDistricts}
                      excludedValues={excludedLandUseDistricts}
                      onChange={setExcludedLandUseDistricts}
                      formatValue={dataFilterValueLabel}
                    />
                    <MultiSelectFilter
                      label="Permitted / discretionary"
                      values={permittedDiscretionaryValues}
                      excludedValues={excludedPermittedDiscretionary}
                      onChange={setExcludedPermittedDiscretionary}
                      formatValue={dataFilterValueLabel}
                    />
                    <MultiSelectFilter
                      label="Appeal statuses"
                      values={APPEAL_FILTER_VALUES}
                      excludedValues={excludedAppealStatuses}
                      onChange={setExcludedAppealStatuses}
                      formatValue={appealStatusFilterValueLabel}
                    />
                  </div>
                  <div className="filter-preference-actions">
                    <button
                      type="button"
                      className="save-default-button"
                      onClick={saveCurrentFiltersAsDefault}
                      disabled={savedDefaultMatchesCurrent}
                    >
                      {savedDefaultMatchesCurrent ? "Default saved" : "Set current as default"}
                    </button>
                    {savedFilterDefaults && !savedDefaultMatchesCurrent && (
                      <button type="button" onClick={() => {
                        applyFilterDefaults(savedFilterDefaults);
                        setFilterDefaultsMessage("Saved filter default restored.");
                      }}>
                        Restore saved default
                      </button>
                    )}
                    {hasActiveFilters && <button type="button" onClick={clearCurrentFilters}>Clear filters</button>}
                    {savedFilterDefaults && (
                      <button type="button" onClick={removeSavedFilterDefault}>Forget saved default</button>
                    )}
                  </div>
                  <p className="filter-storage-note">
                    Your saved default stays only in this browser until you replace it, forget it here or clear this site&apos;s browser data.
                  </p>
                </div>
                <button type="button" className="filter-drawer-apply" onClick={closeFilterDrawer}>
                  Show {filtered.length.toLocaleString("en-CA")} matches
                </button>
              </section>
            </div>
          )}
          {selectedOutsideLatest && !showAll && (
            <p className="pinned-selection-note" role="status">
              Selected permit {text(selectedPermit?.permitnum)} is pinned above the latest 12 permits.
            </p>
          )}
          <div className="permit-list" aria-label="Matching permits">
            {displayed.map((permit, index) => (
              <button
                className={selectedPermit?.permitnum === permit.permitnum ? "permit-row selected" : "permit-row"}
                key={`${permit.permitnum}-${index}`}
                ref={selected === permit.permitnum ? selectedExplorerRow : undefined}
                aria-pressed={selectedPermit?.permitnum === permit.permitnum}
                onClick={() => setSelected(permit.permitnum ?? null)}
              >
                <span className="permit-id"><StatusDot group={groupFor(permit.statuscurrent)} /><strong>{text(permit.permitnum)}</strong><small>{formatDate(permit.applieddate)}</small></span>
                <span className="permit-address"><strong>{text(permit.address)}</strong><small>{text(permit.description)}</small></span>
                <span className={`status-pill status-${groupFor(permit.statuscurrent)}`}>{text(permit.statuscurrent)}</span>
                <span className="row-arrow" aria-hidden="true">→</span>
              </button>
            ))}
            {!displayed.length && <p className="empty-state">No permits match those filters.</p>}
          </div>
          {recent.length > 12 && <button className="load-more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show latest 12" : `Show all ${recent.length.toLocaleString("en-CA")}`}</button>}
        </aside>

        <div className="linked-map-stack" aria-label="Community overview and street-level permit maps">
          <article className="panel map-panel overview-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Overview · 1 of 2</p><h2>Community activity pattern</h2></div>
            <p>Viewport count shown on map</p>
          </div>
          <PermitMap
            points={plotted}
            selectedPermitNumber={selectedPermit?.permitnum}
            focusPermitNumber={selected ?? undefined}
            communityName={config.site.communityDisplayName}
            mapConfig={config.map}
            view="overview"
            onSelect={setSelected}
          />
          <div className="overview-legend" role="list" aria-label="Community activity pattern colour legend">
            {(Object.entries(STATUS_GUIDES) as Array<[StatusGuideGroup, (typeof STATUS_GUIDES)[StatusGuideGroup]]>).map(([legendGroup, guide]) => (
              <div className="legend-entry" role="listitem" key={legendGroup}>
                <button
                  type="button"
                  className="legend-item"
                  aria-describedby={`status-help-${legendGroup}`}
                  onMouseEnter={() => setHoveredGuide(legendGroup)}
                  onMouseLeave={() => setHoveredGuide(null)}
                  onFocus={() => setHoveredGuide(legendGroup)}
                  onBlur={() => setHoveredGuide(null)}
                  onClick={() => setHoveredGuide(hoveredGuide === legendGroup ? null : legendGroup)}
                >
                  <StatusDot group={legendGroup} />
                  {guide.label}
                </button>
              </div>
            ))}
          </div>
          {hoveredGuide && (
            <aside className={`status-guide-popover overview-guide-popover status-${hoveredGuide}`} role="status">
              <p className="status-guide-label">{STATUS_GUIDES[hoveredGuide].label}</p>
              <strong>{STATUS_GUIDES[hoveredGuide].meaning}</strong>
              <p>{STATUS_GUIDES[hoveredGuide].detail}</p>
            </aside>
          )}
          <div className="sr-only">
            {(Object.entries(STATUS_GUIDES) as Array<[StatusGuideGroup, (typeof STATUS_GUIDES)[StatusGuideGroup]]>).map(([guideGroup, guide]) => (
              <p id={`status-help-${guideGroup}`} key={guideGroup}>{guide.meaning} {guide.detail}</p>
            ))}
          </div>
          <p className="map-note">Each point represents one filtered permit record with valid coordinates. Pan or zoom to change the points in view; select a point to link both maps and the permit details.</p>
          </article>

          <article className="panel map-panel granular-map-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Granular view · 2 of 2</p><h2>Street-level permit map</h2></div>
            <p>Viewport count shown on map</p>
          </div>
          <PermitMap
            points={plotted}
            selectedPermitNumber={selectedPermit?.permitnum}
            focusPermitNumber={selectedPermit?.permitnum}
            communityName={config.site.communityDisplayName}
            mapConfig={config.map}
            view="street"
            onSelect={setSelected}
          />
          <p className="map-note">Each point represents one filtered permit record with valid coordinates. Pan or zoom to update the in-view count; the selected permit remains outlined and linked to the overview.</p>
          </article>
        </div>

        <article className="panel detail-panel linked-detail-panel">
          <p className="eyebrow">Linked selection · both views</p>
          {selectedPermit ? (
            <>
              <p className="sr-only" role="status" aria-live="polite">
                Selected permit {text(selectedPermit.permitnum)}; details updated.
              </p>
              <div className="permit-title-row">
                <div><h2>{text(selectedPermit.permitnum)}</h2><p>{text(selectedPermit.address)}</p></div>
                <span className={`status-pill status-${groupFor(selectedPermit.statuscurrent)}`}>{text(selectedPermit.statuscurrent)}</span>
              </div>
              <p className="linked-selection-note">Highlighted in the community overview and the street-level map.</p>
              <p className="permit-description">{text(selectedPermit.description)}</p>
              <dl className="detail-list">
                <div><FieldTerm label="Proposed use" definitionId="proposed-use" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.proposedusedescription)}</dd></div>
                <div><FieldTerm label="Permitted / discretionary" definitionId="permitted-discretionary" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.permitteddiscretionary)}</dd></div>
                <div><FieldTerm label="Land-use district" definitionId="land-use-district" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.landusedistrict)}</dd></div>
                <div><FieldTerm label="Concurrent land-use redesignation" definitionId="concurrent-redesignation" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.concurrent_loc)}</dd></div>
                <div><FieldTerm label="Current status" definitionId="current-status" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.statuscurrent)}</dd></div>
                <div><FieldTerm label="Applied date" definitionId="applied-date" onExplain={revealPermitFieldDefinition} /><dd>{formatDate(selectedPermit.applieddate)}</dd></div>
                <div><FieldTerm label="Decision" definitionId="decision" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.decision)}</dd></div>
                <div><FieldTerm label="Decision date" definitionId="decision-date" onExplain={revealPermitFieldDefinition} /><dd>{formatDate(selectedPermit.decisiondate)}</dd></div>
                <div><FieldTerm label="Released date" definitionId="released-date" onExplain={revealPermitFieldDefinition} /><dd>{formatDate(selectedPermit.releasedate)}</dd></div>
                <div><FieldTerm label="Must commence date" definitionId="must-commence-date" onExplain={revealPermitFieldDefinition} /><dd>{formatDate(selectedPermit.mustcommencedate)}</dd></div>
                <div><FieldTerm label="Decision by" definitionId="decision-by" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.decisionby)}</dd></div>
                <div><FieldTerm label="SDAB number" definitionId="sdab-number" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.sdabnumber)}</dd></div>
                <div><FieldTerm label="SDAB decision" definitionId="sdab-decision" onExplain={revealPermitFieldDefinition} /><dd>{text(selectedPermit.sdabdecision)}</dd></div>
              </dl>
              <details id="permit-field-guide" className="permit-field-guide" ref={permitFieldGuide}>
                <summary>What do these permit fields mean?</summary>
                <div className="permit-field-guide-content">
                  <label htmlFor="permit-field-guide-search">Search field definitions</label>
                  <input
                    id="permit-field-guide-search"
                    type="search"
                    value={fieldGuideQuery}
                    onChange={(event) => setFieldGuideQuery(event.target.value)}
                    placeholder="Search definitions…"
                  />
                  <p className="field-guide-note">
                    These explanations summarize City-published fields. The official application, decision, permit, Land Use Bylaw and appeal decision remain authoritative.
                  </p>
                  <dl>
                    {visiblePermitFieldDefinitions.map(({ id, label, definition, values }) => (
                      <div id={`permit-field-definition-${id}`} className="permit-field-definition" tabIndex={-1} key={id}>
                        <dt>{label}</dt>
                        <dd>{definition}</dd>
                        {!!values.length && (
                          <details className="field-value-glossary" open={fieldGuideQuery.trim() ? true : undefined}>
                            <summary>Meanings of {values.length} values in the loaded Varsity records</summary>
                            <ul>
                              {values.map(({ value, meaning }) => (
                                <li key={`${id}-${value}`}>
                                  <strong>{value}</strong>
                                  <span>{meaning}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ))}
                  </dl>
                  {!visiblePermitFieldDefinitions.length && (
                    <p className="empty-field-guide">No field definitions match that search.</p>
                  )}
                  <p className="field-guide-note"><strong>Not reported</strong> means the City source did not provide a value. It does not automatically mean “none,” “no” or “not applicable.”</p>
                </div>
              </details>
              {selectedAppealNumber && (
                <div className={`appeal-action ${selectedPermit.appealreporturl ? "" : "appeal-package-missing"}`}>
                  <p className="appeal-label">
                    {selectedPermit.appealreporturl ? "Public SDAB appeal package" : "Appeal package not currently linked"}
                  </p>
                  <p className="appeal-summary">
                    Appeal {selectedAppealNumber}
                    {selectedPermit.sdabhearingdate ? ` · Hearing ${formatDate(selectedPermit.sdabhearingdate)}` : ""}
                  </p>
                  {!selectedPermit.appealreporturl && (
                    <p className="appeal-missing-explanation">
                      {selectedAppealIsDecided
                        ? "Calgary records a decision for this appeal, but its reports and plans are no longer linked from the Active Appeals page."
                        : "Calgary does not currently list a public report package for this appeal. It may not have been posted yet."}
                    </p>
                  )}
                  {selectedAppealRecord && (
                    <section className="appeal-decision-card" aria-labelledby="appeal-decision-heading">
                      <p className="decision-source">
                        {selectedAppealRecordIsSdab
                          ? "Formatted from Calgary’s SDAB Decisions JSON"
                          : "Formatted from appeal fields in Calgary’s Development Permits feed"}
                      </p>
                      <h3 id="appeal-decision-heading">{text(selectedAppealRecord.appealDecision)}</h3>
                      <p className="decision-meaning">{appealOutcomeMeaning(selectedAppealRecord.appealDecision)}</p>
                      <dl className="appeal-decision-grid">
                        <div><dt>Appeal number</dt><dd>{text(selectedAppealRecord.appealNumber)}</dd></div>
                        <div><dt>Related permit</dt><dd>{text(selectedAppealRecord.permitNumber)}</dd></div>
                        <div><dt>Property address</dt><dd>{text(selectedAppealRecord.address)}</dd></div>
                        <div><dt>Development type</dt><dd>{text(selectedAppealRecord.propertyType)}</dd></div>
                        <div className="wide"><dt>Proposed use</dt><dd>{text(selectedAppealRecord.propertyUse)}</dd></div>
                        <div><dt>Original City decision</dt><dd>{text(selectedAppealRecord.originalDecision)}</dd></div>
                        <div><dt>Appeal filed</dt><dd>{formatDate(selectedAppealRecord.appealFiledDate)}</dd></div>
                        <div><dt>First Board meeting</dt><dd>{formatDate(selectedAppealRecord.initialMeetingDate)}</dd></div>
                        <div><dt>Final Board session</dt><dd>{formatDate(selectedAppealRecord.finalSessionDate)}</dd></div>
                        <div><dt>Written decision issued</dt><dd>{formatDate(selectedAppealRecord.decisionIssuedDate)}</dd></div>
                      </dl>
                      <p className="appeal-record-note">
                        {selectedAppealRecordIsSdab
                          ? "The dashboard reformats Calgary’s JSON fields for readability; it does not change the City’s values."
                          : "Calgary’s separate SDAB decision JSON did not return a match, so this card uses the appeal fields already published in the Development Permits feed."}
                      </p>
                      <details className="appeal-dummies-guide">
                        <summary>Plain-language guide: what do these fields mean?</summary>
                        <dl>
                          <div><dt>Appeal number</dt><dd>The Board’s tracking number for this appeal—not the development-permit number.</dd></div>
                          <div><dt>Related permit</dt><dd>The original City application that someone appealed.</dd></div>
                          <div><dt>Property address</dt><dd>The location Calgary associates with the appealed application.</dd></div>
                          <div><dt>Development type</dt><dd>Calgary’s broad category for the kind of property or project involved.</dd></div>
                          <div><dt>Proposed use</dt><dd>What the development application asked permission to build or operate.</dd></div>
                          <div><dt>Original City decision</dt><dd>What the City decided before the appeal was heard.</dd></div>
                          <div><dt>Appeal filed</dt><dd>When the appeal was submitted to SDAB.</dd></div>
                          <div><dt>First Board meeting</dt><dd>The first scheduled SDAB session. It is not necessarily the final hearing date.</dd></div>
                          <div><dt>Final Board session</dt><dd>The last listed session before the Board completed its hearing process.</dd></div>
                          <div><dt>Written decision issued</dt><dd>When the Board’s written decision was released. This can be later than the hearing.</dd></div>
                          <div><dt>Outcome</dt><dd>The Board’s result. Conditions and exact legal effects come from the official written decision, not this summary.</dd></div>
                          <div><dt>Not reported or —</dt><dd>The City source used for this card did not provide that value. It does not automatically mean “none,” “no” or “not applicable.”</dd></div>
                        </dl>
                      </details>
                    </section>
                  )}
                  <section className="canlii-metadata-card" aria-live="polite" aria-labelledby="canlii-metadata-heading">
                    <p className="decision-source">CanLII decision metadata</p>
                    <h3 id="canlii-metadata-heading">Official decision catalogue record</h3>
                    {!selectedCanliiLookup || selectedCanliiLookup.status === "loading" ? (
                      <p className="canlii-state">Checking the cached CanLII catalogue…</p>
                    ) : selectedCanliiLookup.status === "available" ? (
                      <>
                        <p className="canlii-title">{selectedCanliiLookup.metadata.title}</p>
                        <dl className="appeal-decision-grid canlii-metadata-grid">
                          <div><dt>Citation</dt><dd>{selectedCanliiLookup.metadata.citation}</dd></div>
                          <div><dt>Docket / appeal number</dt><dd>{text(selectedCanliiLookup.metadata.docketNumber)}</dd></div>
                          <div><dt>Decision date</dt><dd>{formatDate(selectedCanliiLookup.metadata.decisionDate)}</dd></div>
                          <div><dt>Language</dt><dd>{text(selectedCanliiLookup.metadata.language)}</dd></div>
                          <div className="wide"><dt>Keywords</dt><dd>{text(selectedCanliiLookup.metadata.keywords)}</dd></div>
                        </dl>
                        <a className="canlii-decision-link" href={selectedCanliiLookup.metadata.url} target="_blank" rel="noreferrer">
                          Read the complete decision on CanLII <span aria-hidden="true">↗</span>
                        </a>
                        <p className="appeal-record-note">
                          Metadata checked {formatDateTime(selectedCanliiLookup.cachedAt)}. The written decision remains on CanLII and is not copied into this dashboard.
                        </p>
                      </>
                    ) : (
                      <p className="canlii-state">
                        {selectedCanliiLookup.status === "not_configured"
                          ? "The secure CanLII connection is ready, but its API key has not been installed. The search links below still work."
                          : selectedCanliiLookup.status === "authentication_failed"
                            ? "CanLII rejected the installed API key. The key must be replaced in the Cloudflare Worker secret before live metadata can be retrieved."
                          : selectedCanliiLookup.status === "not_found"
                            ? "CanLII has not returned a matching decision record yet. Publication can follow Calgary’s initial appeal result."
                            : selectedCanliiLookup.status === "rate_limited"
                              ? "The approved CanLII lookup allowance has been reached. Cached records and the search links remain available."
                              : "CanLII could not be checked right now. Cached Calgary information and the search links remain available."}
                      </p>
                    )}
                    <details className="appeal-dummies-guide canlii-guide">
                      <summary>Plain-language guide: what is CanLII metadata?</summary>
                      <dl>
                        <div><dt>Title</dt><dd>The official name attached to the published decision.</dd></div>
                        <div><dt>Citation</dt><dd>The standard legal reference used to identify the decision.</dd></div>
                        <div><dt>Docket / appeal number</dt><dd>The tribunal’s tracking number, used to match the decision to Calgary’s appeal record.</dd></div>
                        <div><dt>Decision date</dt><dd>The date associated with the Board’s written decision.</dd></div>
                        <div><dt>Keywords</dt><dd>Descriptive topics supplied with the catalogue record. They are not the complete decision text.</dd></div>
                        <div><dt>Decision link</dt><dd>Opens the complete public decision on CanLII. The API supplies the link, not the document itself.</dd></div>
                      </dl>
                    </details>
                  </section>
                  <div className="appeal-links">
                    {selectedPermit.appealreporturl && (
                      <a href={selectedPermit.appealreporturl} target="_blank" rel="noreferrer">
                        View appeal reports, submissions &amp; plans <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {selectedDecisionRecordUrl && (
                      <a className="secondary-appeal-link" href={selectedDecisionRecordUrl} target="_blank" rel="noreferrer">
                        Open this record in Calgary Open Data <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {selectedDecisionJsonUrl && (
                      <a className="secondary-appeal-link" href={selectedDecisionJsonUrl} target="_blank" rel="noreferrer">
                        View original Calgary JSON source <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {selectedCanliiUrl && selectedCanliiCitation && (
                      <a className="secondary-appeal-link" href={selectedCanliiUrl} target="_blank" rel="noreferrer">
                        Open CanLII decision: {selectedCanliiCitation} <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    <a className="secondary-appeal-link" href={config.links.canliiTribunalUrl} target="_blank" rel="noreferrer">
                      Browse all Calgary SDAB decisions on CanLII <span aria-hidden="true">↗</span>
                    </a>
                    {!selectedPermit.appealreporturl && (
                      <a className="secondary-appeal-link" href={config.links.appealContactUrl} target="_blank" rel="noreferrer">
                        Contact SDAB about archived documents <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                  <p className="appeal-note">
                    A package link appears only while Calgary publishes an exact public match. A missing link does not mean the documents never existed.
                  </p>
                  <p className="appeal-note canlii-note">
                    CanLII may publish the written decision after Calgary first reports the outcome. This dashboard links to CanLII but does not copy or scrape its decision documents.
                  </p>
                </div>
              )}
              {selectedApplicationUrl && (
                <div className="plans-action">
                  <a href={selectedApplicationUrl} target="_blank" rel="noreferrer">
                    Try permit-specific DMap link <span aria-hidden="true">↗</span>
                  </a>
                  <a className="official-dmap-link" href={config.links.developmentMapUrl} target="_blank" rel="noreferrer">
                    Double-check Calgary&apos;s official Development Map <span aria-hidden="true">↗</span>
                  </a>
                  <p><strong>Always verify the permit number on Calgary&apos;s official Development Map.</strong> The permit-specific link above is only a convenience and may not resolve correctly. A permit may also appear in Open Data before its DMap page or plans are available.</p>
                </div>
              )}
            </>
          ) : <p className="empty-state">Choose a point in either visualization or select a permit below.</p>}
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">How the pace has changed</p><h2>Applications by permit year</h2></div>
          <p>Latest 8 years · select a bar to show or hide that year</p>
        </div>
        <div className="bar-chart" aria-label="Permit counts by year">
          {yearCounts.map((item) => (
            <button
              key={item.year}
              className={excludedYearSet.has(item.year) ? "bar-column excluded" : "bar-column"}
              aria-pressed={!excludedYearSet.has(item.year)}
              aria-label={`${item.year}: ${item.count} permits; ${excludedYearSet.has(item.year) ? "show year" : "hide year"}`}
              onClick={() => setExcludedYears(toggledExclusions(excludedYears, item.year))}
            >
              <span className="bar-value">{item.count}</span>
              <span className="bar-track"><span style={{ height: `${Math.max(5, (item.count / maxYearCount) * 100)}%` }} /></span>
              <span className="bar-year">{item.year}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="reading-guide">
        <div><p className="eyebrow">Read the signal carefully</p><h2>What this dashboard can—and cannot—tell you</h2></div>
        <div className="guide-cards">
          <article><span>01</span><h3>Open data is an early signal</h3><p>A permit can appear here before it appears in DMap. Treat it as a prompt to watch DMap for the application record and any public plans—not as confirmation that DMap is ready.</p></article>
          <article><span>02</span><h3>Status needs context</h3><p>“Pending,” “approved,” and “released” are different milestones. Read the decision, release and appeal dates together.</p></article>
          <article><span>03</span><h3>Verify before acting</h3><p>Double-check the permit number on Calgary&apos;s official Development Map. For comments, appeals or deadlines, also confirm the file with the assigned City planner or official notice.</p></article>
        </div>
      </section>

      <section className="data-scope-notice" aria-labelledby="data-scope-heading">
        <div>
          <p className="eyebrow">Community-filter disclaimer</p>
          <h2 id="data-scope-heading">This dashboard is filtered for {config.site.communityDisplayName}.</h2>
        </div>
        <div className="scope-copy">
          <p>
            This is not a citywide permit list. The Calgary Open Data query is restricted to records
            where <code>{config.feedScope.filterField}</code> is <code>{config.feedScope.filterValue}</code>, so every count, map, chart and
            permit list on this page describes the {config.site.communityDisplayName} community only.
          </p>
          <p>
            To reuse this dashboard for another Calgary community, edit <code>config/dashboard.json</code>:
            set the community display text and replace <code>{config.feedScope.filterValue}</code> with
            the exact community name used in Calgary Open Data. The application builds the corresponding
            API and JSON-query URLs automatically.
          </p>
          <a href={filteredQueryUrl} target="_blank" rel="noreferrer">
            Open the {config.site.communityDisplayName}-filtered JSON query <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <footer>
        <div><p className="brand-name">{config.site.name}</p><p>Built for informed community discussion.</p></div>
        <div className="footer-links"><a href={datasetUrl} target="_blank" rel="noreferrer">Calgary Open Data ↗</a><a href={config.links.developmentMapUrl} target="_blank" rel="noreferrer">Development Map ↗</a></div>
        <p className="licence-note">Contains information licensed under the Open Government Licence – City of Calgary. Independent community project; not affiliated with or endorsed by The City of Calgary.</p>
      </footer>
    </main>
  );
}
