"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
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
const HIT_LAYER_ID = "permit-point-hit-targets";
const POINT_LAYER_ID = "permit-points";
const SELECTED_LAYER_ID = "selected-permit";

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

export default function PermitMap({
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
  const pointsRef = useRef(points);
  const onSelectRef = useRef(onSelect);
  const selectedPermitRef = useRef(selectedPermitNumber);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [visiblePointCount, setVisiblePointCount] = useState(points.length);

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

    const map = new MapLibreMap({
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

    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const updateVisibleCount = () => {
      setVisiblePointCount(pointsInsideViewport(map, pointsRef.current));
    };

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: featureCollection(pointsRef.current),
      });

      // Keep the visual dots compact while giving every record a 44 CSS-pixel
      // pointer/touch target. This layer is transparent but remains interactive.
      map.addLayer({
        id: HIT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": 22,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": [
            "match",
            ["get", "group"],
            "active", "#d86638",
            "approved", "#1b6b55",
            "closed", "#a94840",
            "#8b9497",
          ],
          "circle-radius": view === "overview" ? 5 : 7,
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": view === "overview" ? 1.5 : 2,
          "circle-opacity": 0.82,
        },
      });

      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "permitNumber"], selectedPermitRef.current ?? "__none__"],
        paint: {
          "circle-color": "rgba(255,253,248,0)",
          "circle-radius": view === "overview" ? 11 : 15,
          "circle-stroke-color": "#17242d",
          "circle-stroke-width": 4,
        },
      });

      map.on("click", HIT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const permitNumber = String(feature?.properties?.permitNumber ?? "").trim();
        if (permitNumber) onSelectRef.current(permitNumber);
      });

      map.on("mouseenter", HIT_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", HIT_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });

      map.on("moveend", updateVisibleCount);
      fitPoints(map, pointsRef.current, mapConfig.fallbackBounds);
      updateVisibleCount();
      mapReadyRef.current = true;
      setMapError(false);
      setMapReady(true);
    });

    map.on("error", () => {
      if (!mapReadyRef.current) setMapError(true);
    });

    return () => {
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [mapConfig, view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection(points));
    setVisiblePointCount(pointsInsideViewport(map, points));
  }, [mapReady, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    map.setFilter(SELECTED_LAYER_ID, [
      "==",
      ["get", "permitNumber"],
      selectedPermitNumber ?? "__none__",
    ]);

    const selected = points.find(
      (point) => point.permit.permitnum?.trim() === focusPermitNumber,
    );
    if (selected) {
      map.easeTo({
        center: [selected.lon, selected.lat],
        zoom: Math.max(map.getZoom(), view === "overview" ? 13 : 15),
        duration: 450,
      });
    }
  }, [focusPermitNumber, mapReady, points, selectedPermitNumber, view]);

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
        onClick={() => mapRef.current && fitPoints(mapRef.current, points, mapConfig.fallbackBounds)}
      >
        Fit filtered permits
      </button>
      <p className="map-visible-count" role="status" aria-live="polite">
        <strong>{visiblePointCount.toLocaleString("en-CA")}</strong> of {points.length.toLocaleString("en-CA")} permit points in this view
      </p>
      {!mapReady && !mapError && <p className="map-status">Loading Calgary street map…</p>}
      {mapError && (
        <p className="map-status map-error" role="status">
          Street tiles are unavailable. Permit records and filters remain available below.
        </p>
      )}
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
