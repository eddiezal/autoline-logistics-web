"use client";

/**
 * TransitMap — interactive map for the IN-TRANSIT customer portal stage.
 *
 * Renders the route from origin to destination using **real road routing**
 * (Mapbox Directions API), split at the current vehicle position into:
 *
 *   - **Traveled segment**: solid lime line from origin → current
 *   - **Remaining segment**: dashed gray line from current → destination
 *
 * The split point is computed by finding the closest route coordinate to the
 * vehicle's reported lat/lng — accurate enough for visualization at any
 * cross-country scale.
 *
 * The route geometry is fetched once and cached in localStorage keyed by
 * the origin/destination coordinate pair, so repeat visits don't re-hit
 * Mapbox's Directions API (free tier is 100k/mo so this is mostly a UX
 * snappiness optimization, not a quota concern).
 *
 * Token: NEXT_PUBLIC_MAPBOX_TOKEN. Without it the component renders a
 * graceful placeholder.
 *
 * Phase B follow-ups:
 *   - Animated marker movement when currentLocation updates
 *   - Server-side route prefetch + cache in Firestore so the first visit is
 *     instant too
 *   - SD webhook → live currentLocation push without page refresh
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Address, Location } from "@/lib/types/shipment";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type Coord = [number, number]; // [lng, lat] per GeoJSON convention

interface Props {
  origin: Address;
  destination: Address;
  currentLocation: Location;
  /** Optional CSS height for the map container; defaults to 340px. */
  heightPx?: number;
}

export function TransitMap({
  origin,
  destination,
  currentLocation,
  heightPx = 340,
}: Props) {
  if (!MAPBOX_TOKEN) {
    return <MapTokenMissing currentLocation={currentLocation} heightPx={heightPx} />;
  }
  return (
    <MapboxView
      origin={origin}
      destination={destination}
      currentLocation={currentLocation}
      heightPx={heightPx}
    />
  );
}

/* ============================================================
 * Mapbox view (when token is configured)
 * ============================================================ */

function MapboxView({ origin, destination, currentLocation, heightPx }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [route, setRoute] = useState<Coord[] | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const hasOriginCoords =
    typeof origin.latitude === "number" && typeof origin.longitude === "number";
  const hasDestinationCoords =
    typeof destination.latitude === "number" &&
    typeof destination.longitude === "number";

  /** Fetch the road-routed polyline (with localStorage cache). */
  useEffect(() => {
    if (!hasOriginCoords || !hasDestinationCoords) return;

    const originCoord: Coord = [origin.longitude!, origin.latitude!];
    const destCoord: Coord = [destination.longitude!, destination.latitude!];
    const cacheKey =
      `mapbox_route_${originCoord[0]},${originCoord[1]}_${destCoord[0]},${destCoord[1]}`;

    // Try cache first.
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Coord[];
        if (Array.isArray(parsed) && parsed.length > 1) {
          setRoute(parsed);
          return;
        }
      }
    } catch {
      // Ignore parse errors and re-fetch.
    }

    setRouteLoading(true);
    fetchDirections(originCoord, destCoord)
      .then((coords) => {
        setRoute(coords);
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(coords));
        } catch {
          // localStorage may be full / blocked — non-fatal.
        }
      })
      .catch((err) => {
        console.warn("[TransitMap] Directions fetch failed; falling back to straight line.", err);
        setRoute(null);
      })
      .finally(() => setRouteLoading(false));
  }, [
    origin.longitude,
    origin.latitude,
    destination.longitude,
    destination.latitude,
    hasOriginCoords,
    hasDestinationCoords,
  ]);

  /**
   * Split the route at the closest point to currentLocation, producing two
   * sub-polylines: traveled (origin → current) and remaining (current → dest).
   *
   * Fallback when no route is available: a straight 3-point polyline.
   */
  const { traveledGeoJSON, remainingGeoJSON, fitPoints } = useMemo(() => {
    const currentCoord: Coord = [currentLocation.lng, currentLocation.lat];

    if (route && route.length > 1) {
      const splitIdx = closestRouteIndex(route, currentCoord);
      const traveled = route.slice(0, splitIdx + 1);
      const remaining = route.slice(splitIdx);
      return {
        traveledGeoJSON: lineFeature(traveled),
        remainingGeoJSON: lineFeature(remaining),
        fitPoints: route,
      };
    }

    // Fallback: straight lines when route hasn't loaded (or failed).
    const trav: Coord[] = hasOriginCoords
      ? [[origin.longitude!, origin.latitude!], currentCoord]
      : [currentCoord];
    const rem: Coord[] = hasDestinationCoords
      ? [currentCoord, [destination.longitude!, destination.latitude!]]
      : [currentCoord];
    const fit: Coord[] = [currentCoord];
    if (hasOriginCoords) fit.push([origin.longitude!, origin.latitude!]);
    if (hasDestinationCoords) fit.push([destination.longitude!, destination.latitude!]);
    return {
      traveledGeoJSON: lineFeature(trav),
      remainingGeoJSON: lineFeature(rem),
      fitPoints: fit,
    };
  }, [route, currentLocation, origin, destination, hasOriginCoords, hasDestinationCoords]);

  // Auto-fit bounds once the map is ready, with generous padding.
  useEffect(() => {
    if (!mapReady || !mapRef.current || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      mapRef.current.flyTo({ center: fitPoints[0], zoom: 8, duration: 600 });
      return;
    }
    const lons = fitPoints.map((p) => p[0]);
    const lats = fitPoints.map((p) => p[1]);
    const sw: [number, number] = [Math.min(...lons), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lons), Math.max(...lats)];
    mapRef.current.fitBounds([sw, ne], {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      duration: 700,
      maxZoom: 9,
    });
  }, [mapReady, fitPoints]);

  // Imperatively add the route sources + layers via Mapbox GL JS.
  // History: we first tried react-map-gl's declarative <Source>/<Layer>,
  // then imperative with slot: "top". Both silently failed on our custom
  // Standard style (autoexpress/cmq6upa8a001m01smh0jd9zs3) — that style
  // sealed its rendering pipeline and dropped any custom layers regardless
  // of slot. Switched the basemap to mapbox/dark-v11 (classic style); slot
  // is no longer needed there, moveLayer puts our routes on top of the
  // basemap as expected. See _map.tsx mapStyle prop for the longer note.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current.getMap();

    const addRouteLayers = () => {
      if (!map.getSource("route-traveled-source")) {
        map.addSource("route-traveled-source", {
          type: "geojson",
          data: traveledGeoJSON,
        });
        map.addLayer({
          id: "route-traveled",
          type: "line",
          source: "route-traveled-source",
          paint: {
            "line-color": "#84CC16", // brand lime
            "line-width": 4,
            "line-opacity": 0.95,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getSource("route-remaining-source")) {
        map.addSource("route-remaining-source", {
          type: "geojson",
          data: remainingGeoJSON,
        });
        map.addLayer({
          id: "route-remaining",
          type: "line",
          source: "route-remaining-source",
          paint: {
            "line-color": "#94a3b8", // slate-400 — soft, not-yet-traveled
            "line-width": 3,
            "line-opacity": 0.85,
            "line-dasharray": [1, 1.6],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      // Force both layers to absolute top; traveled moved last so it
      // visually sits above the dashed remaining at the current-pin junction.
      if (map.getLayer("route-remaining")) map.moveLayer("route-remaining");
      if (map.getLayer("route-traveled")) map.moveLayer("route-traveled");
    };

    if (map.isStyleLoaded()) {
      addRouteLayers();
    } else {
      map.once("style.load", addRouteLayers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // Push geometry updates onto the existing sources when the route or
  // currentLocation changes (no need to re-add layers).
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const traveledSource = map.getSource("route-traveled-source");
    const remainingSource = map.getSource("route-remaining-source");
    if (traveledSource && "setData" in traveledSource) {
      (traveledSource as { setData: (d: unknown) => void }).setData(traveledGeoJSON);
    }
    if (remainingSource && "setData" in remainingSource) {
      (remainingSource as { setData: (d: unknown) => void }).setData(remainingGeoJSON);
    }
  }, [mapReady, traveledGeoJSON, remainingGeoJSON]);

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        height: heightPx,
        border: "1px solid var(--color-gray-200)",
      }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: currentLocation.lng,
          latitude: currentLocation.lat,
          zoom: 5,
        }}
        // TEMPORARY: swapped from our custom Standard style (autoexpress/
        // cmq6upa8a001m01smh0jd9zs3) to Mapbox's classic dark-v11 because the
        // custom Standard style was silently dropping custom line layers
        // regardless of slot or moveLayer. Classic styles render added line
        // layers unconditionally. If we want to restore the custom monochrome
        // look later, rebuild it on a CLASSIC base style (dark-v11 fork) in
        // Mapbox Studio — NOT on Standard.
        mapStyle="mapbox://styles/mapbox/dark-v11"
        attributionControl={false}
        onLoad={() => setMapReady(true)}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Route polylines (traveled + remaining) are added imperatively in
            the useEffect above. Sources + layers are kept out of the JSX
            tree because we need fine-grained control over render order
            via map.moveLayer(). */}

        {hasOriginCoords && (
          <Marker
            longitude={origin.longitude!}
            latitude={origin.latitude!}
            anchor="bottom"
          >
            <PinMarker tone="origin" label={`${origin.city}, ${origin.state}`} />
          </Marker>
        )}

        <Marker
          longitude={currentLocation.lng}
          latitude={currentLocation.lat}
          anchor="bottom"
        >
          <PinMarker tone="current" label={currentLocation.label} />
        </Marker>

        {hasDestinationCoords && (
          <Marker
            longitude={destination.longitude!}
            latitude={destination.latitude!}
            anchor="bottom"
          >
            <PinMarker
              tone="destination"
              label={`${destination.city}, ${destination.state}`}
            />
          </Marker>
        )}
      </Map>

      {routeLoading && (
        <div
          className="absolute top-3 left-3 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{
            background: "rgba(255,255,255,0.92)",
            color: "var(--color-text-muted)",
            boxShadow: "0 2px 6px rgba(10,30,20,0.15)",
          }}
        >
          Loading route…
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Mapbox Directions API client
 * ============================================================ */

async function fetchDirections(
  origin: Coord,
  destination: Coord,
): Promise<Coord[]> {
  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox Directions ${res.status}`);
  const data = (await res.json()) as {
    routes?: Array<{ geometry?: { coordinates?: Coord[] } }>;
  };
  const route = data.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(route) || route.length < 2) {
    throw new Error("Empty route");
  }
  return route;
}

/* ============================================================
 * Helpers
 * ============================================================ */

function closestRouteIndex(route: Coord[], target: Coord): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < route.length; i++) {
    const dLng = route[i][0] - target[0];
    const dLat = route[i][1] - target[1];
    // Euclidean is fine at country scale for finding the nearest vertex.
    const dist = dLng * dLng + dLat * dLat;
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  return minIdx;
}

function lineFeature(coords: Coord[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: coords,
    },
  };
}

/* ============================================================
 * Custom marker — brand-styled with a lime pulse on the current position
 * ============================================================ */

function PinMarker({
  tone,
  label,
}: {
  tone: "origin" | "current" | "destination";
  label: string;
}) {
  // Brand colors tuned for VISIBILITY on the dark Mapbox base. Pine
  // (var(--color-brand-ink)) is too close to the map land color, so the
  // destination marker would just read as an empty white ring — use a
  // brighter cool gray that still reads as "finished/upcoming" alongside
  // the lime "current" pulse without competing for attention.
  const colorMap = {
    origin: "var(--color-brand-primary)",          // Operator green
    current: "var(--color-brand-accent)",           // Lime — current position
    destination: "#e2e8f0",                          // Slate-200 — visible against dark map
  } as const;
  const isCurrent = tone === "current";
  const color = colorMap[tone];

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ pointerEvents: "none" }}
    >
      {isCurrent && (
        <span
          className="absolute rounded-full"
          style={{
            width: 36,
            height: 36,
            background: "rgba(132, 204, 22, 0.35)",
            bottom: 8,
            animation: "pulse-ring 1.8s ease-out infinite",
          }}
        />
      )}
      <div
        className="rounded-full grid place-items-center"
        style={{
          width: 18,
          height: 18,
          background: color,
          border: "3px solid white",
          boxShadow: "0 2px 6px rgba(10,30,20,0.35)",
          marginBottom: 4,
        }}
        title={label}
      />
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.65); opacity: 0.8; }
          80% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
 * Placeholder when Mapbox token isn't configured
 * ============================================================ */

function MapTokenMissing({
  currentLocation,
  heightPx,
}: {
  currentLocation: Location;
  heightPx: number;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border flex flex-col items-center justify-center gap-2 text-center px-6"
      style={{
        height: heightPx,
        background:
          "color-mix(in oklab, var(--color-brand-primary) 6%, white)",
        borderColor:
          "color-mix(in oklab, var(--color-brand-primary) 22%, white)",
      }}
    >
      <div
        className="text-[14px] font-bold"
        style={{ color: "var(--color-brand-ink)" }}
      >
        Live map setup pending
      </div>
      <div
        className="text-[12.5px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        Your car is currently {currentLocation.label}.
      </div>
      <div
        className="text-[11px] mt-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        (Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the interactive map.)
      </div>
    </div>
  );
}
