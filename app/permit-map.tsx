"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
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
  onSelect: (permitNumber: string) => void;
};

const SOURCE_ID = "filtered-permits";
const CLUSTER_LAYER_ID = "permit-clusters";
const CLUSTER_COUNT_LAYER_ID = "permit-cluster-count";
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
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointsRef = useRef(points);
  const onSelectRef = useRef(onSelect);
  const selectedPermitRef = useRef(selectedPermitNumber);
  const selectedMarkerRef = useRef<Marker | null>(null);
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
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 46,
      });

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#17242d",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 50, 27, 200, 32],
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 3,
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "group"],
            "active", "#d86638",
            "approved", "#1b6b55",
            "closed", "#a94840",
            "#8b9497",
          ],
          "circle-radius": 7,
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "permitNumber"], selectedPermitRef.current ?? "__none__"],
        paint: {
          "circle-color": "rgba(255,253,248,0.72)",
          "circle-radius": 15,
          "circle-stroke-color": "#17242d",
          "circle-stroke-width": 4,
        },
      });

      map.on("click", CLUSTER_LAYER_ID, async (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER_ID] })[0];
        const clusterId = Number(feature?.properties?.cluster_id);
        if (!feature || !Number.isFinite(clusterId) || feature.geometry.type !== "Point") return;

        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 350 });
      });

      map.on("click", POINT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const permitNumber = String(feature?.properties?.permitNumber ?? "").trim();
        if (permitNumber) onSelectRef.current(permitNumber);
      });

      [CLUSTER_LAYER_ID, POINT_LAYER_ID].forEach((layerId) => {
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      });

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
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [mapConfig]);

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

    selectedMarkerRef.current?.remove();
    selectedMarkerRef.current = null;

    const selectedPoint = points.find(
      (point) => point.permit.permitnum?.trim() === selectedPermitNumber,
    );
    if (selectedPoint) {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = `granular-map-point selected status-${selectedPoint.group}`;
      markerButton.setAttribute("aria-label", `Selected permit ${selectedPermitNumber} at ${selectedPoint.permit.address?.trim() || "address not reported"}`);
      markerButton.setAttribute("aria-pressed", "true");
      markerButton.title = `${selectedPermitNumber} · ${selectedPoint.permit.address?.trim() || "Address not reported"}`;
      markerButton.addEventListener("click", () => onSelectRef.current(selectedPermitNumber));
      selectedMarkerRef.current = new Marker({ element: markerButton, anchor: "center" })
        .setLngLat([selectedPoint.lon, selectedPoint.lat])
        .addTo(map);
    }

    const selected = points.find(
      (point) => point.permit.permitnum?.trim() === focusPermitNumber,
    );
    if (selected) {
      map.easeTo({
        center: [selected.lon, selected.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 450,
      });
    }
  }, [focusPermitNumber, mapReady, points, selectedPermitNumber]);

  return (
    <div className="street-map-shell">
      <div
        ref={containerRef}
        className="permit-map"
        role="region"
        aria-label={`Interactive clustered street map of filtered ${communityName} development permits`}
      />
      <button
        type="button"
        className="fit-map-button"
        onClick={() => mapRef.current && fitPoints(mapRef.current, points, mapConfig.fallbackBounds)}
      >
        Fit filtered permits
      </button>
      <p className="map-visible-count" role="status" aria-live="polite">
        <strong>{visiblePointCount.toLocaleString("en-CA")}</strong> of {points.length.toLocaleString("en-CA")} filtered datapoints displayed in this map view
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
        Numbered circles combine nearby permits. Zoom in to separate them, or use the accessible permit list to select any record.
      </p>
    </div>
  );
}
