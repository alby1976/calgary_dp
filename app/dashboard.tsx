"use client";

import { useMemo, useState } from "react";
import type { PublicDashboardConfig } from "../lib/dashboard-config";
import type { Permit } from "../lib/permit";
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

function statusGroup(status: string | undefined, keywords: PublicDashboardConfig["statuses"]) {
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

function StatusDot({ group }: { group: string }) {
  return <span className={`status-dot status-${group}`} aria-hidden="true" />;
}

export default function Dashboard({ permits, fetchedAt, cityDataUpdatedAt, live, config, datasetUrl, filteredQueryUrl }: Props) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [year, setYear] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
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
      const haystack = [permit.permitnum, permit.address, permit.description, permit.applicant, permit.statuscurrent]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesGroup && matchesYear && (!needle || haystack.includes(needle));
    });
  }, [permits, query, group, year, config.statuses]);

  const recent = useMemo(
    () => [...filtered].sort((a, b) => (b.applieddate ?? "").localeCompare(a.applieddate ?? "")),
    [filtered],
  );
  const displayed = showAll ? recent : recent.slice(0, 12);
  const selectedPermit = permits.find((permit) => permit.permitnum === selected) ?? displayed[0];
  const selectedApplicationUrl = developmentMapApplicationUrl(
    selectedPermit?.permitnum,
    config.links.developmentApplicationUrlTemplate,
  );

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

      <section className="story-grid">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Where activity is concentrated</p><h2>Permit geography</h2></div>
            <p>{plotted.length} plotted</p>
          </div>
          <PermitMap
            points={plotted.slice(0, 500)}
            selectedPermitNumber={selectedPermit?.permitnum}
            communityName={config.site.communityDisplayName}
            mapConfig={config.map}
            onSelect={setSelected}
          />
          <p className="map-note">Permit points use City-provided coordinates on a real street basemap. Verify the address and official record before making parcel-level decisions.</p>
        </article>

        <article className="panel detail-panel">
          <p className="eyebrow">Selected permit</p>
          {selectedPermit ? (
            <>
              <div className="permit-title-row">
                <div><h2>{text(selectedPermit.permitnum)}</h2><p>{text(selectedPermit.address)}</p></div>
                <span className={`status-pill status-${groupFor(selectedPermit.statuscurrent)}`}>{text(selectedPermit.statuscurrent)}</span>
              </div>
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
              {selectedPermit.sdabnumber && selectedPermit.appealreporturl && (
                <div className="appeal-action">
                  <p className="appeal-label">Public SDAB appeal package</p>
                  <p className="appeal-summary">
                    Appeal {selectedPermit.sdabnumber}
                    {selectedPermit.sdabhearingdate ? ` · Hearing ${formatDate(selectedPermit.sdabhearingdate)}` : ""}
                  </p>
                  <a href={selectedPermit.appealreporturl} target="_blank" rel="noreferrer">
                    View appeal reports, submissions &amp; plans <span aria-hidden="true">↗</span>
                  </a>
                  <p className="appeal-note">Shown only when Calgary lists a public report package for this appeal.</p>
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
          ) : <p className="empty-state">Choose a point or permit to inspect it.</p>}
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
          {(query || year !== "all" || group !== "all") && <button className="clear-button" onClick={() => { setQuery(""); setYear("all"); setGroup("all"); }}>Clear</button>}
        </div>
        <div className="permit-list">
          {displayed.map((permit, index) => (
            <button className={selected === permit.permitnum ? "permit-row selected" : "permit-row"} key={`${permit.permitnum}-${index}`} onClick={() => setSelected(permit.permitnum ?? null)}>
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
