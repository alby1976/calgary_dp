"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
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
  communityName: string;
  mapConfig: PublicDashboardConfig["map"];
  onSelect: (permitNumber: string) => void;
};

type PermitFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
      permitnum: string;
      address: string;
      group: string;
    };
  }>;
};

function toFeatureCollection(points: MapPoint[]): PermitFeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.flatMap(({ permit, lat, lon, group }) => {
      const permitnum = permit.permitnum?.trim();
      if (!permitnum) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [lon, lat] as [number, number] },
        properties: {
          permitnum,
          address: permit.address?.trim() || "Address not reported",
          group,
        },
      }];
    }),
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

export default function PermitMap({ points, selectedPermitNumber, communityName, mapConfig, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointsRef = useRef(points);
  const onSelectRef = useRef(onSelect);
  const selectedPermitRef = useRef(selectedPermitNumber);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const features = useMemo(() => toFeatureCollection(points), [points]);

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
      map.addSource("permits", {
        type: "geojson",
        data: toFeatureCollection(pointsRef.current),
      });
      map.addLayer({
        id: "permit-points",
        type: "circle",
        source: "permits",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 7],
          "circle-color": [
            "match", ["get", "group"],
            "active", "#d86638",
            "approved", "#1b6b55",
            "closed", "#a94840",
            "#78858a",
          ],
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 2,
          "circle-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "selected-permit",
        type: "circle",
        source: "permits",
        filter: ["==", ["get", "permitnum"], selectedPermitRef.current ?? ""],
        paint: {
          "circle-radius": 12,
          "circle-color": "rgba(255,255,255,0.2)",
          "circle-stroke-color": "#17242d",
          "circle-stroke-width": 3,
        },
      });

      map.on("mouseenter", "permit-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "permit-points", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "permit-points", (event) => {
        const permitNumber = event.features?.[0]?.properties?.permitnum;
        if (typeof permitNumber === "string") onSelectRef.current(permitNumber);
      });

      fitPoints(map, pointsRef.current, mapConfig.fallbackBounds);
      setMapReady(true);
    });

    map.on("error", () => setMapError(true));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapConfig]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    (map.getSource("permits") as GeoJSONSource | undefined)?.setData(features);
  }, [features, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer("selected-permit")) return;
    map.setFilter("selected-permit", ["==", ["get", "permitnum"], selectedPermitNumber ?? ""]);

    const selected = points.find((point) => point.permit.permitnum === selectedPermitNumber);
    if (selected && !map.getBounds().contains([selected.lon, selected.lat])) {
      map.easeTo({ center: [selected.lon, selected.lat], duration: 350 });
    }
  }, [mapReady, points, selectedPermitNumber]);

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
