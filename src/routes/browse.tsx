import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowRight,
  Award,
  BellPlus,
  Check,
  Copy,
  Flag,
  Heart,
  ImageOff,
  LayoutGrid,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Recycle,
  Search,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NeighborhoodMap } from "@/components/NeighborhoodMap";
import { ReportListingDialog } from "@/components/ReportListingDialog";
import { RequestDialog, type RequestDialogItem } from "@/components/RequestDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/hooks/use-location";
import { useWatchAlerts } from "@/hooks/use-watch-alerts";
import { useWishlist } from "@/hooks/use-wishlist";
import { fetchItems } from "@/lib/available-items";
import {
  browseCategoryLabel,
  browseConditionLabel,
  browseFilterCategories,
  cardAction,
  filterItems,
  type BrowseCategory,
  type BrowseCondition,
  type BrowseRadiusKm,
} from "@/lib/item-browse";
import { itemConditions } from "@/lib/item-form";
import { itemDistance, itemRewardPoints } from "@/lib/rebuy";
import { fetchRequestedItemIds } from "@/lib/requests";
import { itemShareUrl, itemWhatsAppShareUrl } from "@/lib/share";
import { fetchOwnerTrust, loadReportedItems } from "@/lib/trust";

const browseSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  cat: fallback(z.string(), "all").default("all"),
  item: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/browse")({
  validateSearch: zodValidator(browseSearchSchema),
  head: () => ({
    meta: [
      { title: "Browse Items – Rebuy" },
      {
        name: "description",
        content:
          "Search and filter furniture, clothes, electronics, books and toys shared on Rebuy, then request the ones you want.",
      },
      { property: "og:title", content: "Browse Items – Rebuy" },
      { property: "og:description", content: "Find free reusable items near you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Browse,
});

function conditionLabel(condition: string) {
  return itemConditions.find((c) => c.value === condition)?.label ?? condition;
}

function Browse() {
  const { q, cat, item: itemParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const { user } = useAuth();
  const { location, locating, locate } = useLocation();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { alerts, addAlert, removeAlert } = useWatchAlerts();

  const [listingFilter, setListingFilter] = useState<"all" | "give" | "exchange">("all");
  const [conditionFilter, setConditionFilter] = useState<BrowseCondition>("all");
  const [radiusKm, setRadiusKm] = useState<BrowseRadiusKm>(0);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [requestTarget, setRequestTarget] = useState<RequestDialogItem | null>(null);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [reports, setReports] = useState(() => loadReportedItems(user?.id));
  const [alertKeyword, setAlertKeyword] = useState("");
  const [alertCategory, setAlertCategory] = useState<string>("all");

  const { data, isLoading, error } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: requested } = useQuery({
    queryKey: ["requested-items", user?.id],
    queryFn: () => fetchRequestedItemIds(user!.id),
    enabled: !!user,
  });

  const activeDetailId = localDetailId || itemParam || null;
  const detailItem = useMemo(
    () => (activeDetailId ? (data ?? []).find((i) => i.id === activeDetailId) ?? null : null),
    [activeDetailId, data],
  );

  const { data: ownerTrust } = useQuery({
    queryKey: ["owner-trust", detailItem?.user_id],
    queryFn: () => fetchOwnerTrust(detailItem!.user_id),
    enabled: !!detailItem,
  });

  const hiddenReportedIds = useMemo(
    () => new Set(reports.filter((r) => r.hidden).map((r) => r.itemId)),
    [reports],
  );

  const category: BrowseCategory = (browseFilterCategories as readonly string[]).includes(cat)
    ? (cat as BrowseCategory)
    : "all";

  const visible = useMemo(() => {
    const filtered = filterItems(
      (data ?? []).filter((i) => !hiddenReportedIds.has(i.id)),
      {
        query: q,
        category,
        condition: conditionFilter,
        listingType: listingFilter,
        radiusKm,
        location,
      },
    );
    if (!location) return filtered;
    return [...filtered].sort((a, b) => {
      const da = itemDistance(a, location);
      const db = itemDistance(b, location);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [data, hiddenReportedIds, q, category, conditionFilter, listingFilter, radiusKm, location]);

  const similarItems = useMemo(() => {
    if (!detailItem || !data) return [];
    return data
      .filter(
        (i) =>
          i.id !== detailItem.id &&
          !hiddenReportedIds.has(i.id) &&
          i.category === detailItem.category,
      )
      .slice(0, 3);
  }, [detailItem, data, hiddenReportedIds]);

  const setQuery = (value: string) =>
    navigate({ search: (prev) => ({ ...prev, q: value }), replace: true });
  const setCategory = (value: BrowseCategory) =>
    navigate({ search: (prev) => ({ ...prev, cat: value }) });

  const openDetail = (id: string) => {
    setLocalDetailId(id);
  };

  const closeDetail = () => {
    setLocalDetailId(null);
    if (itemParam) {
      navigate({ search: (prev) => ({ ...prev, item: "" }), replace: true });
    }
  };

  const handleRadiusChange = (value: string) => {
    const next = Number(value) as BrowseRadiusKm;
    setRadiusKm(next);
    if (next > 0 && !location) {
      locate();
    }
  };

  const openRequest = (item: NonNullable<typeof data>[number]) => {
    if (!user) {
      toast.error("Please log in to request an item");
      navigate({ to: "/login", search: { redirect: "/browse" } });
      return;
    }
    setRequestTarget({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      listing_type: item.listing_type,
      wants: item.wants,
    });
  };

  const copyShareLink = async (itemId: string) => {
    try {
      await navigator.clipboard.writeText(itemShareUrl(itemId));
      toast.success("Item link copied!");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">Browse Items</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find something you need — free for the taking or open to exchange.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-8 px-2.5"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "map" ? "default" : "ghost"}
              className="h-8 px-2.5"
              onClick={() => setViewMode("map")}
            >
              <MapIcon className="h-4 w-4" />
              Map View
            </Button>
          </div>
          <Button
            type="button"
            variant={location ? "secondary" : "outline"}
            size="sm"
            disabled={locating}
            onClick={locate}
          >
            <LocateFixed className="h-4 w-4" />
            {locating ? "Locating..." : location ? "Sorted near you" : "Near me"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <BellPlus className="h-4 w-4 text-gold-deep" />
                Looking For Alerts{alerts.length > 0 ? ` (${alerts.length})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3 p-4">
              <div>
                <p className="font-display text-sm font-semibold">Looking For Item Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Get notified in your bell when a matching item is posted.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (addAlert(alertKeyword, alertCategory)) {
                    setAlertKeyword("");
                  }
                }}
                className="space-y-2"
              >
                <Input
                  value={alertKeyword}
                  onChange={(e) => setAlertKeyword(e.target.value)}
                  placeholder="e.g. study desk, bicycle, novel..."
                  maxLength={60}
                  className="h-8 text-xs"
                />
                <div className="flex gap-2">
                  <Select value={alertCategory} onValueChange={setAlertCategory}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any category</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="clothes">Clothes</SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="books">Books</SelectItem>
                      <SelectItem value="toys">Toys</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" className="h-8 text-xs">
                    Save Alert
                  </Button>
                </div>
              </form>
              {alerts.length > 0 && (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Alerts
                  </p>
                  <ul className="max-h-36 space-y-1 overflow-y-auto">
                    {alerts.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-accent/50 px-2.5 py-1.5 text-xs"
                      >
                        <span className="truncate font-medium text-primary">
                          {a.keyword || "Any item"}{" "}
                          <span className="capitalize text-muted-foreground">({a.category})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAlert(a.id)}
                          aria-label="Remove alert"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button asChild size="sm">
            <Link to="/post">Post an Item</Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-soft">
        <Search className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, description or location"
          aria-label="Search items"
          className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {browseFilterCategories.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={category === value ? "secondary" : "outline"}
              onClick={() => setCategory(value)}
            >
              {browseCategoryLabel(value)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={conditionFilter}
            onValueChange={(v) => setConditionFilter(v as BrowseCondition)}
          >
            <SelectTrigger className="h-8 w-[145px] text-xs" aria-label="Condition filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Conditions</SelectItem>
              {itemConditions.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(radiusKm)} onValueChange={handleRadiusChange}>
            <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Distance filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any distance</SelectItem>
              <SelectItem value="5">Within 5 km</SelectItem>
              <SelectItem value="10">Within 10 km</SelectItem>
              <SelectItem value="25">Within 25 km</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1.5">
            {(
              [
                { value: "all", label: "All Types" },
                { value: "give", label: "Free Give" },
                { value: "exchange", label: "Exchange" },
              ] as const
            ).map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={listingFilter === t.value ? "default" : "outline"}
                onClick={() => setListingFilter(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading items...</p>}
      {error && <p className="text-destructive">Couldn't load items.</p>}
      {!isLoading && !error && data && (
        <p className="mb-4 text-sm text-muted-foreground">
          {visible.length} {visible.length === 1 ? "item" : "items"}
          {category !== "all" && ` in ${browseCategoryLabel(category)}`}
          {conditionFilter !== "all" && ` · ${browseConditionLabel(conditionFilter)}`}
          {radiusKm > 0 && ` · within ${radiusKm} km`}
          {listingFilter !== "all" && ` (${listingFilter === "give" ? "Free" : "Exchange"})`}
          {q && ` matching "${q.trim()}"`}
        </p>
      )}

      {!isLoading && !error && data && visible.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <p className="font-display text-xl font-bold">
            {data.length === 0 ? "No items yet - be the first to post!" : "No items match your filters"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try widening your distance radius, clearing a filter, or saving a Looking For alert.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setListingFilter("all");
                setConditionFilter("all");
                setRadiusKm(0);
                navigate({ search: () => ({ q: "", cat: "all", item: "" }) });
              }}
            >
              Clear search and filters
            </Button>
            {q.trim() && (
              <Button onClick={() => addAlert(q.trim(), category)}>
                <BellPlus className="h-4 w-4" />
                Save Looking For Alert
              </Button>
            )}
          </div>
        </div>
      )}

      {viewMode === "map" && !isLoading && !error && visible.length > 0 && (
        <NeighborhoodMap
          items={visible}
          userLocation={location}
          locating={locating}
          onLocate={locate}
          onSelectDetail={openDetail}
        />
      )}

      {viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const action = cardAction({
              isMine: !!user && item.user_id === user.id,
              isRequested: !!requested?.has(item.id),
            });
            const wishlisted = isWishlisted(item.id);
            const dist = itemDistance(item, location);
            const rewards = itemRewardPoints(item);

            return (
              <article
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
                  <button
                    type="button"
                    onClick={() => openDetail(item.id)}
                    className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`View details for ${item.name}`}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageOff className="h-7 w-7" />
                        <span className="text-xs">No photo</span>
                      </div>
                    )}
                  </button>
                  <span className="absolute left-4 top-4 rounded-md bg-gold px-2.5 py-1 text-xs font-semibold text-gold-foreground">
                    {item.listing_type === "exchange" ? "EXCHANGE" : "FREE"}
                  </span>
                  <div className="absolute right-4 top-4 flex items-center gap-1.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Share ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/60 bg-background/90 text-primary shadow-sm transition-transform hover:scale-105"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-48 space-y-1 p-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start text-xs"
                          onClick={() => copyShareLink(item.id)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy link
                        </Button>
                        <Button asChild size="sm" variant="ghost" className="w-full justify-start text-xs">
                          <a
                            href={itemWhatsAppShareUrl(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                            Share on WhatsApp
                          </a>
                        </Button>
                      </PopoverContent>
                    </Popover>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(item.id, item.name)}
                      aria-label={wishlisted ? `Remove ${item.name} from wishlist` : `Save ${item.name} to wishlist`}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border border-gold/60 bg-background/90 shadow-sm transition-transform hover:scale-105 ${
                        wishlisted ? "text-rose-600" : "text-primary"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`} />
                    </button>
                  </div>
                  <span className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-gold bg-primary text-gold">
                    <Recycle className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openDetail(item.id)}
                      className="text-left hover:underline"
                    >
                      <h2 className="font-display text-xl font-bold leading-tight">{item.name}</h2>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {conditionLabel(item.condition)}
                    </span>
                    <span className="flex items-center gap-1 text-primary">
                      <MapPin className="h-4 w-4" />
                      {item.location} · <span className="capitalize">{item.category}</span>
                    </span>
                    {dist !== null && (
                      <span className="text-xs font-medium text-gold-deep">
                        {dist < 1 ? "< 1 km away" : `${dist.toFixed(1)} km away`}
                      </span>
                    )}
                  </div>
                  {item.listing_type === "exchange" && item.wants && (
                    <p className="text-xs font-medium text-gold-deep">Wants: {item.wants}</p>
                  )}
                  {item.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                  )}
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Award className="h-3.5 w-3.5 text-gold-deep" />
                    Receiver +{rewards.receiver} pts · Donor +{rewards.donor} pts
                  </p>
                  <div className="mt-auto border-t border-gold/45 pt-3">
                    {action === "mine" ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/my-posts">Your item · Manage</Link>
                      </Button>
                    ) : action === "requested" ? (
                      <Button variant="secondary" className="w-full" disabled>
                        <Check /> Requested
                      </Button>
                    ) : (
                      <Button
                        variant="request"
                        className="w-full"
                        onClick={() => openRequest(item)}
                      >
                        {item.listing_type === "exchange" ? "Offer Exchange" : "Request"}{" "}
                        <ArrowRight className="ml-auto" />
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!detailItem} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {detailItem && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-start justify-between gap-2 pr-6">
                  <div>
                    <DialogTitle className="font-display text-2xl">{detailItem.name}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {detailItem.location} · <span className="capitalize">{detailItem.category}</span> ·{" "}
                      {conditionLabel(detailItem.condition)}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {ownerTrust && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                    <ShieldCheck className="h-4 w-4 text-gold-deep" />
                    {ownerTrust.displayName}
                  </span>
                  <span className="text-muted-foreground">
                    {ownerTrust.givenCount > 0
                      ? `Trusted Giver · ${ownerTrust.givenCount} completed ${
                          ownerTrust.givenCount === 1 ? "handover" : "handovers"
                        }`
                      : "Community Member"}
                  </span>
                </div>
              )}

              {detailItem.images && detailItem.images.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {detailItem.images.map((src, i) => (
                    <img
                      key={src + i}
                      src={src}
                      alt={`${detailItem.name} photo ${i + 1}`}
                      className={`w-full rounded-xl object-cover ${
                        i === 0 && detailItem.images.length === 1
                          ? "col-span-full max-h-72"
                          : "h-40"
                      }`}
                    />
                  ))}
                </div>
              )}

              {detailItem.listing_type === "exchange" && detailItem.wants && (
                <div className="rounded-lg border border-gold/40 bg-accent/60 px-3 py-2 text-xs font-medium text-primary">
                  Open to exchange for: {detailItem.wants}
                </div>
              )}

              {detailItem.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {detailItem.description}
                </p>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-gold/40 bg-accent/50 px-3 py-2 text-xs font-medium text-primary">
                <Award className="h-4 w-4 text-gold-deep" />
                <span>
                  Handover rewards: Receiver +{itemRewardPoints(detailItem).receiver} pts · Donor +
                  {itemRewardPoints(detailItem).donor} pts
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleWishlist(detailItem.id, detailItem.name)}
                >
                  <Heart
                    className={`h-4 w-4 ${isWishlisted(detailItem.id) ? "fill-rose-600 text-rose-600" : ""}`}
                  />
                  {isWishlisted(detailItem.id) ? "Wishlisted" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyShareLink(detailItem.id)}
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </Button>
                <Button asChild type="button" variant="outline" size="sm">
                  <a
                    href={itemWhatsAppShareUrl(detailItem)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Share2 className="h-4 w-4 text-emerald-600" />
                    WhatsApp
                  </a>
                </Button>
                {(!user || detailItem.user_id !== user.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => setReportTarget({ id: detailItem.id, name: detailItem.name })}
                  >
                    <Flag className="h-4 w-4" />
                    Report
                  </Button>
                )}
              </div>

              <div className="pt-1">
                {user && detailItem.user_id === user.id ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/my-posts">Manage in My Posts</Link>
                  </Button>
                ) : requested?.has(detailItem.id) ? (
                  <Button variant="secondary" className="w-full" disabled>
                    <Check /> Already Requested
                  </Button>
                ) : (
                  <Button
                    variant="request"
                    className="w-full"
                    onClick={() => {
                      const target = detailItem;
                      closeDetail();
                      openRequest(target);
                    }}
                  >
                    {detailItem.listing_type === "exchange" ? "Offer Exchange" : "Request Item"}
                    <ArrowRight className="ml-auto" />
                  </Button>
                )}
              </div>

              {similarItems.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="font-display text-sm font-semibold">
                    Similar <span className="capitalize">{detailItem.category}</span> nearby
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {similarItems.map((sim) => (
                      <button
                        key={sim.id}
                        type="button"
                        onClick={() => openDetail(sim.id)}
                        className="overflow-hidden rounded-xl border border-border bg-background text-left transition-colors hover:border-gold"
                      >
                        <div className="aspect-[4/3] bg-muted">
                          {sim.image ? (
                            <img src={sim.image} alt={sim.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                              <ImageOff className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="truncate text-xs font-semibold text-foreground">{sim.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{sim.location}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReportListingDialog
        item={reportTarget}
        userId={user?.id}
        open={!!reportTarget}
        onOpenChange={(o) => !o && setReportTarget(null)}
        onReported={(updated) => {
          setReports(updated);
          if (reportTarget && updated.some((r) => r.itemId === reportTarget.id && r.hidden)) {
            closeDetail();
          }
        }}
      />

      {requestTarget && (
        <RequestDialog
          item={requestTarget}
          open={!!requestTarget}
          onOpenChange={(open) => !open && setRequestTarget(null)}
        />
      )}
    </main>
  );
}
