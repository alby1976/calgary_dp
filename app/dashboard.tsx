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

export default function Dashboard({ permits, fetchedAt, cityDataUpdatedAt, live, config, datasetUrl, filteredQueryUrl }: Props) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [year, setYear] = useState("all");
  const [appealFilter, setAppealFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hoveredGuide, setHoveredGuide] = useState<StatusGuideGroup | null>(null);
  const [canliiLookups, setCanliiLookups] = useState<Record<string, CanliiUiState>>({});
  const requestedCanliiAppeals = useRef(new Set<string>());
  const groupFor = (status?: string) => statusGroup(status, config.statuses);

  const years = useMemo(
    () => [...new Set(permits.map(permitYear).filter((value) => value !== "Unknown"))].sort((a, b) => b.localeCompare(a)),
    [permits],
  );

  const grouped = useMemo(() => {
    const counts = { active: 0, approved: 0, closed: 0, other: 0 };
    permits.forEach((permit) => counts[statusGroup(permit.statuscurrent, config.statuses)]++);
    return counts;
  }, [permits, config.statuses]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return permits.filter((permit) => {
      const matchesGroup = group === "all" || statusGroup(permit.statuscurrent, config.statuses) === group;
      const matchesYear = year === "all" || permitYear(permit) === year;
      const matchesAppeal = appealFilter === "all" || Boolean(permit.sdabnumber?.trim());
      const haystack = [permit.permitnum, permit.address, permit.description, permit.applicant, permit.statuscurrent]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesGroup && matchesYear && matchesAppeal && (!needle || haystack.includes(needle));
    });
  }, [permits, query, group, year, appealFilter, config.statuses]);

  const recent = useMemo(
    () => [...filtered].sort((a, b) => (b.applieddate ?? "").localeCompare(a.applieddate ?? "")),
    [filtered],
  );
  const displayed = showAll ? recent : recent.slice(0, 12);
  const selectedPermit = filtered.find((permit) => permit.permitnum === selected) ?? displayed[0];
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

  const plotted = filtered
    .map((permit) => ({
      permit,
      lat: Number(permit.latitude),
      lon: Number(permit.longitude),
      group: groupFor(permit.statuscurrent),
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
  const lats = plotted.map((item) => item.lat);
  const lons = plotted.map((item) => item.lon);
  const minLat = Math.min(...lats, config.map.fallbackBounds.minLatitude);
  const maxLat = Math.max(...lats, config.map.fallbackBounds.maxLatitude);
  const minLon = Math.min(...lons, config.map.fallbackBounds.minLongitude);
  const maxLon = Math.max(...lons, config.map.fallbackBounds.maxLongitude);
  const overviewPointStyle = (lat: number, lon: number) => ({
    left: `${7 + ((lon - minLon) / Math.max(0.001, maxLon - minLon)) * 86}%`,
    top: `${7 + (1 - (lat - minLat) / Math.max(0.001, maxLat - minLat)) * 86}%`,
  });

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
          ["active", "Active / under review", grouped.active],
          ["approved", "Approved / released", grouped.approved],
          ["closed", "Refused / cancelled", grouped.closed],
          ["other", "Other status", grouped.other],
        ].map(([key, label, count]) => (
          <button key={String(key)} className={group === key ? "signal active-filter" : "signal"} onClick={() => setGroup(group === key ? "all" : String(key))}>
            <StatusDot group={String(key)} />
            <span><strong>{Number(count).toLocaleString("en-CA")}</strong>{String(label)}</span>
          </button>
        ))}
      </section>

      <section className="linked-map-grid" aria-label="Linked permit visualizations">
        <article className="panel map-panel overview-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Overview · 1 of 2</p><h2>Community activity pattern</h2></div>
            <p>{plotted.length} plotted</p>
          </div>
          <div className="overview-plot" aria-label={`Simplified overview plot of filtered ${config.site.communityDisplayName} permits`}>
            <span className="north">N ↑</span>
            {config.map.overviewLabels.map((label) => (
              <span key={`${label.className}-${label.text}`} className={`map-road ${label.className}`}>
                {label.text}
              </span>
            ))}
            {plotted.slice(0, 500).map(({ permit, lat, lon, group: permitGroup }, index) => (
              <button
                key={`${permit.permitnum}-${index}`}
                className={`map-point status-${permitGroup} ${selectedPermit?.permitnum === permit.permitnum ? "selected" : ""}`}
                style={overviewPointStyle(lat, lon)}
                title={`${text(permit.permitnum)} · ${text(permit.address)}`}
                aria-label={`Select ${text(permit.permitnum)} at ${text(permit.address)}`}
                aria-describedby={`status-help-${permitGroup}`}
                onMouseEnter={() => setHoveredGuide(permitGroup)}
                onMouseLeave={() => setHoveredGuide(null)}
                onFocus={() => setHoveredGuide(permitGroup)}
                onBlur={() => setHoveredGuide(null)}
                onClick={() => permit.permitnum && setSelected(permit.permitnum)}
              />
            ))}
            {hoveredGuide && (
              <aside className={`status-guide-popover status-${hoveredGuide}`} role="status">
                <p className="status-guide-label">{STATUS_GUIDES[hoveredGuide].label}</p>
                <strong>{STATUS_GUIDES[hoveredGuide].meaning}</strong>
                <p>{STATUS_GUIDES[hoveredGuide].detail}</p>
              </aside>
            )}
          </div>
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
          <div className="sr-only">
            {(Object.entries(STATUS_GUIDES) as Array<[StatusGuideGroup, (typeof STATUS_GUIDES)[StatusGuideGroup]]>).map(([guideGroup, guide]) => (
              <p id={`status-help-${guideGroup}`} key={guideGroup}>{guide.meaning} {guide.detail}</p>
            ))}
          </div>
          <p className="map-note">A simplified coordinate overview for spotting clusters and broad patterns. Select a point to inspect the same permit in the detailed view.</p>
        </article>

        <article className="panel map-panel granular-map-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Granular view · 2 of 2</p><h2>Street-level permit map</h2></div>
            <p>{plotted.length} plotted</p>
          </div>
          <PermitMap
            points={plotted.slice(0, 500)}
            selectedPermitNumber={selectedPermit?.permitnum}
            focusPermitNumber={selected ?? undefined}
            communityName={config.site.communityDisplayName}
            mapConfig={config.map}
            onSelect={setSelected}
          />
          <p className="map-note">City-provided coordinates shown against Calgary streets. Selecting a point highlights the same permit in the overview.</p>
        </article>

        <article className="panel detail-panel linked-detail-panel" aria-live="polite" aria-atomic="true">
          <p className="eyebrow">Linked selection · both views</p>
          {selectedPermit ? (
            <>
              <div className="permit-title-row">
                <div><h2>{text(selectedPermit.permitnum)}</h2><p>{text(selectedPermit.address)}</p></div>
                <span className={`status-pill status-${groupFor(selectedPermit.statuscurrent)}`}>{text(selectedPermit.statuscurrent)}</span>
              </div>
              <p className="linked-selection-note">Highlighted in the community overview and the street-level map.</p>
              <p className="permit-description">{text(selectedPermit.description)}</p>
              <dl className="detail-list">
                <div><dt>Applied</dt><dd>{formatDate(selectedPermit.applieddate)}</dd></div>
                <div><dt>Decision</dt><dd>{formatDate(selectedPermit.decisiondate)}</dd></div>
                <div><dt>Released</dt><dd>{formatDate(selectedPermit.releasedate)}</dd></div>
                <div><dt>Must commence</dt><dd>{formatDate(selectedPermit.mustcommencedate)}</dd></div>
                <div><dt>Use</dt><dd>{text(selectedPermit.proposedusedescription)}</dd></div>
                <div><dt>Land use</dt><dd>{text(selectedPermit.landusedistrict)}</dd></div>
                <div><dt>Decision by</dt><dd>{text(selectedPermit.decisionby)}</dd></div>
                <div><dt>SDAB</dt><dd>{selectedPermit.sdabnumber ? `${selectedPermit.sdabnumber} · ${text(selectedPermit.sdabdecision)}` : "No appeal reported"}</dd></div>
              </dl>
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
                        Search CanLII: {selectedCanliiCitation} <span aria-hidden="true">↗</span>
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
                    View City application &amp; plans <span aria-hidden="true">↗</span>
                  </a>
                  <p>Submitted plans appear on DMap only while The City makes them publicly available.</p>
                </div>
              )}
            </>
          ) : <p className="empty-state">Choose a point in either visualization or select a permit below.</p>}
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">How the pace has changed</p><h2>Applications by permit year</h2></div>
          <p>Latest 8 years in feed</p>
        </div>
        <div className="bar-chart" aria-label="Permit counts by year">
          {yearCounts.map((item) => (
            <button key={item.year} className={year === item.year ? "bar-column selected" : "bar-column"} onClick={() => setYear(year === item.year ? "all" : item.year)}>
              <span className="bar-value">{item.count}</span>
              <span className="bar-track"><span style={{ height: `${Math.max(5, (item.count / maxYearCount) * 100)}%` }} /></span>
              <span className="bar-year">{item.year}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="permit-explorer" className="explorer">
        <div className="explorer-heading">
          <div><p className="eyebrow">Find the record, then ask better questions</p><h2>Permit explorer</h2></div>
          <p>{filtered.length.toLocaleString("en-CA")} matching permits</p>
        </div>
        <div className="filters">
          <label className="search-field">
            <span className="sr-only">Search permits</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search address, permit, applicant or description…" />
          </label>
          <label>
            <span className="sr-only">Filter by year</span>
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              <option value="all">All years</option>
              {years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select value={group} onChange={(event) => setGroup(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active / under review</option>
              <option value="approved">Approved / released</option>
              <option value="closed">Refused / cancelled</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by appeal status</span>
            <select value={appealFilter} onChange={(event) => setAppealFilter(event.target.value)}>
              <option value="all">All appeal statuses</option>
              <option value="appealed">Appealed to SDAB</option>
            </select>
          </label>
          {(query || year !== "all" || group !== "all" || appealFilter !== "all") && (
            <button
              className="clear-button"
              onClick={() => {
                setQuery("");
                setYear("all");
                setGroup("all");
                setAppealFilter("all");
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="permit-list">
          {displayed.map((permit, index) => (
            <button className={selectedPermit?.permitnum === permit.permitnum ? "permit-row selected" : "permit-row"} key={`${permit.permitnum}-${index}`} onClick={() => setSelected(permit.permitnum ?? null)}>
              <span className="permit-id"><StatusDot group={groupFor(permit.statuscurrent)} /><strong>{text(permit.permitnum)}</strong><small>{formatDate(permit.applieddate)}</small></span>
              <span className="permit-address"><strong>{text(permit.address)}</strong><small>{text(permit.description)}</small></span>
              <span className={`status-pill status-${groupFor(permit.statuscurrent)}`}>{text(permit.statuscurrent)}</span>
              <span className="row-arrow">→</span>
            </button>
          ))}
          {!displayed.length && <p className="empty-state">No permits match those filters.</p>}
        </div>
        {recent.length > 12 && <button className="load-more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show latest 12" : `Show all ${recent.length.toLocaleString("en-CA")}`}</button>}
      </section>

      <section className="reading-guide">
        <div><p className="eyebrow">Read the signal carefully</p><h2>What this dashboard can—and cannot—tell you</h2></div>
        <div className="guide-cards">
          <article><span>01</span><h3>Open data is a lead</h3><p>It can surface newer status and date fields, but it is not a statutory notice and may still lag internal City systems.</p></article>
          <article><span>02</span><h3>Status needs context</h3><p>“Pending,” “approved,” and “released” are different milestones. Read the decision, release and appeal dates together.</p></article>
          <article><span>03</span><h3>Verify before acting</h3><p>For comments, appeals or deadlines, confirm the file with the assigned City planner or the official notice.</p></article>
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
