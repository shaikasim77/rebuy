import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AdvancedMarker,
  APIProvider,
  APILoadingStatus,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { Award, LocateFixed, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEnvMapsKey, getPublicMapsKey } from "@/lib/maps-config";
import { dispatchMapsQuotaExceeded } from "@/lib/maps-quota";
import { itemDistance, itemRewardPoints, type Coordinates } from "@/lib/rebuy";

export interface MapItem {
  id: string;
  name: string;
  category: string;
  condition: string;
  listing_type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  image?: string | undefined;
}

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 }; // Hyderabad default community center

function ItemMarker({
  item,
  selected,
  onSelect,
  onOpenDetail,
  userLocation,
}: {
  item: MapItem & { latitude: number; longitude: number };
  selected: boolean;
  onSelect: () => void;
  onOpenDetail: (id: string) => void;
  userLocation: Coordinates | null;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const rewards = itemRewardPoints(item);
  const dist = itemDistance(item, userLocation);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: item.latitude, lng: item.longitude }}
        onClick={onSelect}
        title={item.name}
      >
        <Pin
          background={item.listing_type === "exchange" ? "#C9A227" : "#0B1F5C"}
          borderColor={selected ? "#FFFFFF" : "#C9A227"}
          glyphColor={item.listing_type === "exchange" ? "#0B1F5C" : "#F6EED5"}
          scale={selected ? 1.25 : 1.05}
        />
      </AdvancedMarker>

      {selected && marker && (
        <InfoWindow anchor={marker} maxWidth={250} onCloseClick={onSelect}>
          <div className="space-y-2 p-0.5 text-foreground">
            {item.image && (
              <img
                src={item.image}
                alt={item.name}
                className="h-24 w-full rounded-lg object-cover"
              />
            )}
            <div>
              <p className="font-display text-sm font-bold leading-snug text-[#0B1F5C]">
                {item.name}
              </p>
              <p className="text-[11px] text-slate-600">
                {item.location} · <span className="capitalize">{item.category}</span>
                {dist !== null ? ` · ${dist.toFixed(1)} km` : ""}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#80630D]">
                <Award className="h-3 w-3" />
                Receiver +{rewards.receiver} · Donor +{rewards.donor} pts
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => onOpenDetail(item.id)}
            >
              View & Request
            </Button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapsApiHealthMonitor() {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      dispatchMapsQuotaExceeded();
    }
  }, [status]);
  return null;
}

function FallbackCoordinateMap({
  pinnedItems,
  userLocation,
  onSelectDetail,
}: {
  pinnedItems: (MapItem & { latitude: number; longitude: number })[];
  userLocation: Coordinates | null;
  onSelectDetail: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(pinnedItems[0]?.id ?? null);
  const selectedItem = pinnedItems.find((i) => i.id === selectedId) ?? null;

  const bounds = useMemo(() => {
    const pts = pinnedItems.map((i) => ({ lat: i.latitude, lng: i.longitude }));
    if (userLocation) pts.push({ lat: userLocation.latitude, lng: userLocation.longitude });
    if (!pts.length) {
      return { minLat: 17.3, maxLat: 17.5, minLng: 78.35, maxLng: 78.6 };
    }
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const padLat = Math.max(0.02, (Math.max(...lats) - Math.min(...lats)) * 0.25);
    const padLng = Math.max(0.02, (Math.max(...lngs) - Math.min(...lngs)) * 0.25);
    return {
      minLat: Math.min(...lats) - padLat,
      maxLat: Math.max(...lats) + padLat,
      minLng: Math.min(...lngs) - padLng,
      maxLng: Math.max(...lngs) + padLng,
    };
  }, [pinnedItems, userLocation]);

  const project = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / Math.max(0.0001, bounds.maxLng - bounds.minLng)) * 100;
    const y = (1 - (lat - bounds.minLat) / Math.max(0.0001, bounds.maxLat - bounds.minLat)) * 100;
    return {
      left: `${Math.min(92, Math.max(8, x))}%`,
      top: `${Math.min(88, Math.max(12, y))}%`,
    };
  };

  return (
    <div className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-[#F6EED5]/60 via-background to-[#E5E1D6]/40 shadow-soft">
      {/* Subtle coordinate radar grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(201,162,39,0.28) 1px, transparent 1px), linear-gradient(to right, rgba(11,31,92,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,31,92,0.08) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {userLocation && (
        <div
          style={project(userLocation.latitude, userLocation.longitude)}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          title="Your location"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky-600 shadow">
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
        </div>
      )}

      {pinnedItems.map((item) => {
        const pos = project(item.latitude, item.longitude);
        const active = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            style={pos}
            onClick={() => setSelectedId(item.id)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-md transition-transform hover:scale-105 ${
              active
                ? "z-20 border-gold bg-primary text-primary-foreground ring-2 ring-gold"
                : "z-10 border-gold/70 bg-card text-primary"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-gold" />
              <span className="max-w-[110px] truncate">{item.name}</span>
            </span>
          </button>
        );
      })}

      {pinnedItems.length === 0 && (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="max-w-sm rounded-xl border border-border bg-card/95 p-4 text-sm text-muted-foreground shadow-sm">
            No items in this filter have GPS coordinates attached yet. Use the list below or attach
            GPS when posting an item!
          </p>
        </div>
      )}

      {selectedItem && (
        <div className="absolute bottom-4 left-4 right-4 z-30 mx-auto max-w-sm rounded-xl border border-gold/50 bg-card p-3.5 shadow-lift">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold text-foreground">
                {selectedItem.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedItem.location} · <span className="capitalize">{selectedItem.category}</span>
              </p>
              <p className="mt-1 text-[11px] font-semibold text-gold-deep">
                Receiver +{itemRewardPoints(selectedItem).receiver} · Donor +
                {itemRewardPoints(selectedItem).donor} pts
              </p>
            </div>
            <Button size="sm" onClick={() => onSelectDetail(selectedItem.id)}>
              View
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NeighborhoodMap({
  items,
  userLocation,
  locating,
  onLocate,
  onSelectDetail,
}: {
  items: MapItem[];
  userLocation: Coordinates | null;
  locating: boolean;
  onLocate: () => void;
  onSelectDetail: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const envKey = getEnvMapsKey();

  const { data: serverMapsConfig } = useQuery({
    queryKey: ["maps-config"],
    queryFn: () => getPublicMapsKey(),
    enabled: !envKey,
    staleTime: Infinity,
  });

  const apiKey = envKey || serverMapsConfig?.apiKey || "";

  const pinnedItems = useMemo(
    () =>
      items.filter(
        (i): i is MapItem & { latitude: number; longitude: number } =>
          typeof i.latitude === "number" && typeof i.longitude === "number",
      ),
    [items],
  );

  const unpinnedItems = useMemo(
    () => items.filter((i) => typeof i.latitude !== "number" || typeof i.longitude !== "number"),
    [items],
  );

  const mapCenter = useMemo(() => {
    if (userLocation) return { lat: userLocation.latitude, lng: userLocation.longitude };
    const first = pinnedItems[0];
    if (first) return { lat: first.latitude, lng: first.longitude };
    return DEFAULT_CENTER;
  }, [userLocation, pinnedItems]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Navigation className="h-4 w-4 text-gold-deep" />
          <span>
            Showing <strong>{pinnedItems.length}</strong> GPS-pinned{" "}
            {pinnedItems.length === 1 ? "item" : "items"}
            {unpinnedItems.length > 0 && ` · ${unpinnedItems.length} listed by city below`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Free Give
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Exchange
          </span>
          {!userLocation && (
            <Button type="button" size="sm" variant="outline" disabled={locating} onClick={onLocate}>
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? "Locating..." : "Center on me"}
            </Button>
          )}
        </div>
      </div>

      {apiKey ? (
        <div className="h-[440px] w-full overflow-hidden rounded-2xl border border-gold/45 shadow-soft">
          <APIProvider apiKey={apiKey} libraries={["marker"]}>
            <MapsApiHealthMonitor />
            <GoogleMap
              defaultCenter={mapCenter}
              defaultZoom={12}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              style={{ width: "100%", height: "100%" }}
            >
              {userLocation && (
                <AdvancedMarker
                  position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
                  title="Your location"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky-600 shadow-md">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </div>
                </AdvancedMarker>
              )}
              {pinnedItems.map((item) => (
                <ItemMarker
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => toggleSelected(item.id)}
                  onOpenDetail={onSelectDetail}
                  userLocation={userLocation}
                />
              ))}
            </GoogleMap>
          </APIProvider>
        </div>
      ) : (
        <FallbackCoordinateMap
          pinnedItems={pinnedItems}
          userLocation={userLocation}
          onSelectDetail={onSelectDetail}
        />
      )}

      {unpinnedItems.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="mb-3 font-display text-base font-semibold">
            City-listed items without exact GPS pin ({unpinnedItems.length})
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unpinnedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectDetail(item.id)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-gold/70 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.location} · <span className="capitalize">{item.category}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
                  +{itemRewardPoints(item).receiver} pts
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
