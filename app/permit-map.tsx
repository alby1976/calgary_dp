"use client";

import { useEffect, useRef, useState } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import type { PublicDashboardConfig } from "../lib/dashboard-config";
import type { Permit } from "../lib/permit";

type MapPoint = {
  permit: Permit;
  lat: number;
  lon: number;
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

type MarkerEntry = {
  marker: Marker;
  element: HTMLButtonElement;
  permitNumber: string;
};

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
  const markerEntriesRef = useRef<MarkerEntry[]>([]);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

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

    map.on("load", () => {
      fitPoints(map, pointsRef.current, mapConfig.fallbackBounds);
      mapReadyRef.current = true;
      setMapError(false);
      setMapReady(true);
    });

    map.on("error", () => {
      if (!mapReadyRef.current) setMapError(true);
    });

    return () => {
      markerEntriesRef.current.forEach(({ marker }) => marker.remove());
      markerEntriesRef.current = [];
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [mapConfig]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    markerEntriesRef.current.forEach(({ marker }) => marker.remove());
    markerEntriesRef.current = points.flatMap(({ permit, lat, lon, group }) => {
      const permitNumber = permit.permitnum?.trim();
      if (!permitNumber) return [];

      const element = document.createElement("button");
      element.type = "button";
      element.className = `granular-map-point status-${group}`;
      element.title = `${permitNumber} · ${permit.address?.trim() || "Address not reported"}`;
      element.setAttribute(
        "aria-label",
        `Select ${permitNumber} at ${permit.address?.trim() || "address not reported"}`,
      );
      element.setAttribute("aria-pressed", String(permitNumber === selectedPermitRef.current));
      element.classList.toggle("selected", permitNumber === selectedPermitRef.current);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(permitNumber);
      });

      const marker = new Marker({ element, anchor: "center" })
        .setLngLat([lon, lat])
        .addTo(map);

      return [{ marker, element, permitNumber }];
    });
  }, [mapReady, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    markerEntriesRef.current.forEach(({ element, permitNumber }) => {
      const isSelected = permitNumber === selectedPermitNumber;
      element.classList.toggle("selected", isSelected);
      element.setAttribute("aria-pressed", String(isSelected));
    });

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
        aria-label={`Interactive street map of filtered ${communityName} development permits`}
      />
      <button
        type="button"
        className="fit-map-button"
        onClick={() => mapRef.current && fitPoints(mapRef.current, points, mapConfig.fallbackBounds)}
      >
        Fit visible permits
      </button>
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
        Select the accessible permit list below to inspect a record without using the map.
      </p>
    </div>
  );
}
