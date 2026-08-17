"use client";

import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import type { PublicDashboardConfig } from "../lib/dashboard-config";
import type { Permit } from "../lib/permit";

type MapPoint = {
  permit: Permit;
  lat: number;
  lon: number;
  group: string;
};

type PermitFeatureProperties = {
  permitNumber: string;
  address: string;
  group: string;
};

type Props = {
  points: MapPoint[];
  selectedPermitNumber?: string;
  focusPermitNumber?: string;
  communityName: string;
  mapConfig: PublicDashboardConfig["map"];
  view: "overview" | "street";
  onSelect: (permitNumber: string) => void;
};

const SOURCE_ID = "filtered-permits";
const MAPLIBRE_WORKER_URL = "/assets/maplibre-gl-worker.mjs";

// Vite bundles MapLibre into a hashed dashboard chunk. Set the worker path
// explicitly so it never depends on import.meta.url rewriting or chunk names.
setWorkerUrl(MAPLIBRE_WORKER_URL);

function supportsWebGL2() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

function safelyRemoveMap(map: MapLibreMap | null) {
  if (!map) return;

  try {
    map.remove();
  } catch {
    // MapLibre can throw here when construction stopped before its internal
    // WebGL resources were fully initialized. Cleanup must never take down the
    // permit explorer or the other map.
  }
}

type MapErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type MapErrorBoundaryState = {
  failed: boolean;
};

class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const FALLBACK_WIDTH = 1000;
const FALLBACK_HEIGHT = 560;
const FALLBACK_PADDING = 34;

function StaticPermitPlot({
  points,
  selectedPermitNumber,
  communityName,
  mapConfig,
  view,
  onSelect,
}: Props) {
  const mapLabel = view === "overview" ? "Community overview map" : "Street-level permit map";
  const geographicBounds = points.length ? {
    minLatitude: Math.min(...points.map(({ lat }) => lat)),
    maxLatitude: Math.max(...points.map(({ lat }) => lat)),
    minLongitude: Math.min(...points.map(({ lon }) => lon)),
    maxLongitude: Math.max(...points.map(({ lon }) => lon)),
  } : mapConfig.fallbackBounds;
  const latitudeSpan = Math.max(geographicBounds.maxLatitude - geographicBounds.minLatitude, 0.002);
  const longitudeSpan = Math.max(geographicBounds.maxLongitude - geographicBounds.minLongitude, 0.002);
  const project = (lon: number, lat: number) => ({
    x: FALLBACK_PADDING + ((lon - geographicBounds.minLongitude) / longitudeSpan) * (FALLBACK_WIDTH - FALLBACK_PADDING * 2),
    y: FALLBACK_PADDING + ((geographicBounds.maxLatitude - lat) / latitudeSpan) * (FALLBACK_HEIGHT - FALLBACK_PADDING * 2),
  });

  return (
    <div className="street-map-shell map-isolated-fallback">
      <svg
        className={`permit-map static-permit-plot ${view === "overview" ? "overview-map" : "street-level-map"}`}
        viewBox={`0 0 ${FALLBACK_WIDTH} ${FALLBACK_HEIGHT}`}
        role="img"
        aria-label={`${mapLabel} compatibility view for ${communityName}, showing ${points.length.toLocaleString("en-CA")} filtered permit points`}
        preserveAspectRatio="none"
      >
        <rect className="static-map-background" width={FALLBACK_WIDTH} height={FALLBACK_HEIGHT} />
        {[0.2, 0.4, 0.6, 0.8].map((fraction) => (
          <g key={fraction} className="static-map-grid" aria-hidden="true">
            <line x1={FALLBACK_WIDTH * fraction} y1="0" x2={FALLBACK_WIDTH * fraction} y2={FALLBACK_HEIGHT} />
            <line x1="0" y1={FALLBACK_HEIGHT * fraction} x2={FALLBACK_WIDTH} y2={FALLBACK_HEIGHT * fraction} />
          </g>
        ))}
        {points.map((point, index) => {
          const permitNumber = point.permit.permitnum?.trim() ?? "";
          const position = project(point.lon, point.lat);
          const selected = permitNumber && permitNumber === selectedPermitNumber;
          return (
            <g key={`${permitNumber || "permit"}-${index}`}>
              <circle
                className="static-map-hit-target"
                cx={position.x}
                cy={position.y}
                r="18"
                onClick={() => permitNumber && onSelect(permitNumber)}
              />
              <circle
                className={`static-map-point status-${point.group}${selected ? " selected" : ""}`}
                cx={position.x}
                cy={position.y}
                r={selected ? 10 : view === "overview" ? 5 : 7}
                aria-hidden="true"
              />
            </g>
          );
        })}
      </svg>
      <p className="map-visible-count" role="status">
        <strong>{points.length.toLocaleString("en-CA")}</strong> permit points shown in compatibility mode
      </p>
      <p className="static-map-notice">
        Interactive street tiles need WebGL2; this coordinate plot keeps every permit location visible.
      </p>
      <div className="map-credits">
        <a href={mapConfig.attributionUrl} target="_blank" rel="noreferrer">
          Coordinate reference © OpenStreetMap contributors
        </a>
        <a href={mapConfig.issueUrl} target="_blank" rel="noreferrer">Report a map issue</a>
      </div>
    </div>
  );
}

function featureCollection(points: MapPoint[]): FeatureCollection<Point, PermitFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: points.map(({ permit, lat, lon, group }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        permitNumber: permit.permitnum?.trim() ?? "",
        address: permit.address?.trim() || "Address not reported",
        group,
      },
    })),
  };
}

function fitPoints(
  map: MapLibreMap,
  points: MapPoint[],
  fallback: PublicDashboardConfig["map"]["fallbackBounds"],
) {
  const bounds = new LngLatBounds();

  if (points.length) {
    points.forEach(({ lon, lat }) => bounds.extend([lon, lat]));
  } else {
    bounds.extend([fallback.minLongitude, fallback.minLatitude]);
    bounds.extend([fallback.maxLongitude, fallback.maxLatitude]);
  }

  map.fitBounds(bounds, {
    padding: { top: 52, right: 52, bottom: 52, left: 52 },
    maxZoom: 15,
    duration: 0,
  });
}

function pointsInsideViewport(map: MapLibreMap, points: MapPoint[]) {
  const bounds = map.getBounds();
  return points.filter(({ lon, lat }) => bounds.contains([lon, lat])).length;
}

type PermitMarkerHandle = {
  element: HTMLButtonElement;
  marker: MapLibreMarker;
  permitNumber: string;
};

function removePermitMarkers(markers: PermitMarkerHandle[]) {
  markers.forEach(({ marker }) => marker.remove());
}

function createPermitMarkers(
  map: MapLibreMap,
  points: MapPoint[],
  selectedPermitNumber: string | undefined,
  view: Props["view"],
  onSelect: (permitNumber: string) => void,
): PermitMarkerHandle[] {
  return points.map((point) => {
    const permitNumber = point.permit.permitnum?.trim() ?? "";
    const address = point.permit.address?.trim() || "Address not reported";
    const status = point.permit.statuscurrent?.trim() || "Status not reported";
    const element = document.createElement("button");

    element.type = "button";
    element.className = [
      "permit-map-marker",
      `status-${point.group}`,
      view === "overview" ? "overview-marker" : "street-marker",
      permitNumber && permitNumber === selectedPermitNumber ? "selected" : "",
    ].filter(Boolean).join(" ");
    element.setAttribute("aria-label", `${permitNumber || "Permit"}, ${address}, ${status}`);
    element.title = `${permitNumber || "Permit"} — ${address}`;

    const dot = document.createElement("span");
    dot.className = "permit-map-marker-dot";
    dot.setAttribute("aria-hidden", "true");
    element.append(dot);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (permitNumber) onSelect(permitNumber);
    });

    const marker = new MapLibreMarker({ element, anchor: "center" })
      .setLngLat([point.lon, point.lat])
      .addTo(map);

    return { element, marker, permitNumber };
  });
}

function PermitMapInner({
  points,
  selectedPermitNumber,
  focusPermitNumber,
  communityName,
  mapConfig,
  view,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<PermitMarkerHandle[]>([]);
  const pointsRef = useRef(points);
  const onSelectRef = useRef(onSelect);
  const selectedPermitRef = useRef(selectedPermitNumber);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [visiblePointCount, setVisiblePointCount] = useState(points.length);

  const markMapUnavailable = useCallback((map: MapLibreMap | null) => {
    mapReadyRef.current = false;
    setMapReady(false);
    setMapError(true);

    if (mapRef.current === map) mapRef.current = null;
    safelyRemoveMap(map);
  }, []);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedPermitRef.current = selectedPermitNumber;
  }, [selectedPermitNumber]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // MapLibre can report a GPU initialization error during construction
    // before its error listener is attached. Preflight WebGL2 so those
    // browsers immediately receive the coordinate-based fallback instead of
    // remaining on a permanent loading state.
    if (!supportsWebGL2()) {
      setMapError(true);
      return;
    }

    let map: MapLibreMap | null = null;

    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            streets: {
              type: "raster",
              tiles: [mapConfig.tileUrlTemplate],
              tileSize: 256,
              minzoom: mapConfig.minZoom,
              maxzoom: mapConfig.maxZoom,
            },
          },
          layers: [{ id: "street-basemap", type: "raster", source: "streets" }],
        },
        attributionControl: false,
        cooperativeGestures: true,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
      });

      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // Only fully constructed instances enter normal update and cleanup paths.
      mapRef.current = map;
    } catch {
      markMapUnavailable(map);
      return;
    }

    const initializedMap = map;

    const updateVisibleCount = () => {
      setVisiblePointCount(pointsInsideViewport(initializedMap, pointsRef.current));
    };

    initializedMap.on("load", () => {
      try {
        initializedMap.addSource(SOURCE_ID, {
          type: "geojson",
          data: featureCollection(pointsRef.current),
        });

        // DOM markers remain visible even when a browser can draw raster tiles
        // but fails to paint MapLibre's worker-backed GeoJSON circle layers.
        // The button is the 44px target; its child is the smaller visual dot.
        markersRef.current = createPermitMarkers(
          initializedMap,
          pointsRef.current,
          selectedPermitRef.current,
          view,
          (permitNumber) => onSelectRef.current(permitNumber),
        );

        initializedMap.on("moveend", updateVisibleCount);
        fitPoints(initializedMap, pointsRef.current, mapConfig.fallbackBounds);
        updateVisibleCount();
        mapReadyRef.current = true;
        setMapError(false);
        setMapReady(true);
      } catch {
        markMapUnavailable(initializedMap);
      }
    });

    initializedMap.on("error", () => {
      if (!mapReadyRef.current) markMapUnavailable(initializedMap);
    });

    return () => {
      mapReadyRef.current = false;
      removePermitMarkers(markersRef.current);
      markersRef.current = [];
      if (mapRef.current === initializedMap) mapRef.current = null;
      safelyRemoveMap(initializedMap);
    };
  }, [mapConfig, markMapUnavailable, view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    try {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(featureCollection(points));
      removePermitMarkers(markersRef.current);
      markersRef.current = createPermitMarkers(
        map,
        points,
        selectedPermitRef.current,
        view,
        (permitNumber) => onSelectRef.current(permitNumber),
      );
      setVisiblePointCount(pointsInsideViewport(map, points));
    } catch {
      markMapUnavailable(map);
    }
  }, [mapReady, markMapUnavailable, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    try {
      markersRef.current.forEach(({ element, permitNumber }) => {
        element.classList.toggle("selected", Boolean(
          permitNumber && permitNumber === selectedPermitNumber,
        ));
      });

      const selected = points.find(
        (point) => point.permit.permitnum?.trim() === focusPermitNumber,
      );
      if (selected) {
        const selectionZoom = view === "overview"
          ? 13
          : Math.min(mapConfig.maxZoom, 18);
        map.easeTo({
          center: [selected.lon, selected.lat],
          zoom: Math.max(map.getZoom(), selectionZoom),
          duration: 450,
        });
      }
    } catch {
      markMapUnavailable(map);
    }
  }, [focusPermitNumber, mapConfig.maxZoom, mapReady, markMapUnavailable, points, selectedPermitNumber, view]);

  if (mapError) {
    return (
      <StaticPermitPlot
        points={points}
        selectedPermitNumber={selectedPermitNumber}
        focusPermitNumber={focusPermitNumber}
        communityName={communityName}
        mapConfig={mapConfig}
        view={view}
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className="street-map-shell">
      <div
        ref={containerRef}
        className={`permit-map ${view === "overview" ? "overview-map" : "street-level-map"}`}
        role="region"
        aria-label={`Interactive ${view === "overview" ? "community overview" : "street-level"} map of filtered ${communityName} development permits; one point per permit record`}
      />
      <button
        type="button"
        className="fit-map-button"
        disabled={!mapReady}
        onClick={() => {
          const map = mapRef.current;
          if (!map) return;
          try {
            fitPoints(map, points, mapConfig.fallbackBounds);
          } catch {
            markMapUnavailable(map);
          }
        }}
      >
        Fit filtered permits
      </button>
      {mapReady && (
          <p className="map-visible-count" role="status" aria-live="polite">
            <strong>{Math.min(visiblePointCount, points.length).toLocaleString("en-CA")}</strong> of {points.length.toLocaleString("en-CA")} permit points in this view
          </p>
      )}
      {!mapReady && !mapError && <p className="map-status">Loading Calgary street map…</p>}
      <div className="map-credits">
        <a href={mapConfig.attributionUrl} target="_blank" rel="noreferrer">
          {mapConfig.attributionLabel}
        </a>
        <a href={mapConfig.issueUrl} target="_blank" rel="noreferrer">Report a map issue</a>
      </div>
      <p className="sr-only">
        Each map point represents one permit record. Pan or zoom to change which records are in view, or use the accessible permit list to select any record.
      </p>
    </div>
  );
}

export default function PermitMap(props: Props) {
  return (
    <MapErrorBoundary fallback={<StaticPermitPlot {...props} />}>
      <PermitMapInner {...props} />
    </MapErrorBoundary>
  );
}
