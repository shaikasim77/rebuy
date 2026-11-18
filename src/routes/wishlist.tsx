import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Award, Check, Heart, ImageOff, MapPin, Recycle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RequestDialog, type RequestDialogItem } from "@/components/RequestDialog";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist } from "@/hooks/use-wishlist";
import { fetchItems } from "@/lib/available-items";
import { itemConditions } from "@/lib/item-form";
import { cardAction } from "@/lib/item-browse";
import { fetchRequestedItemIds } from "@/lib/requests";
import { itemRewardPoints, pageHead } from "@/lib/rebuy";

export const Route = createFileRoute("/wishlist")({
  head: () => pageHead("Wishlist", "Items you saved for later on Rebuy."),
  component: WishlistPage,
});

function conditionLabel(condition: string) {
  return itemConditions.find((c) => c.value === condition)?.label ?? condition;
}

function WishlistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { wishlistIds, toggleWishlist, clearWishlist } = useWishlist();
  const [requestItem, setRequestItem] = useState<RequestDialogItem | null>(null);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const { data: requested } = useQuery({
    queryKey: ["requested-items", user?.id],
    queryFn: () => fetchRequestedItemIds(user!.id),
    enabled: !!user,
  });

  const savedItems = items.filter((item) => wishlistIds.includes(item.id));

  const openRequest = (item: (typeof items)[number]) => {
    if (!user) {
      toast.error("Please log in to request an item");
      navigate({ to: "/login", search: { redirect: "/wishlist" } });
      return;
    }
    setRequestItem({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      listing_type: item.listing_type,
      wants: item.wants,
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">My Wishlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Items you saved to request or revisit later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wishlistIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearWishlist}>
              <Trash2 className="h-4 w-4" />
              Clear wishlist
            </Button>
          )}
          <Button asChild size="sm">
            <Link to="/browse">Browse Items</Link>
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading your saved items...</p>}
      {error && <p className="text-destructive">Couldn't load items.</p>}

      {!isLoading && !error && savedItems.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Heart className="mx-auto h-9 w-9 text-gold-deep" />
          <p className="mt-3 font-display text-xl font-bold">Your wishlist is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the heart icon on any item in Browse to save it here.
          </p>
          <Button asChild className="mt-5">
            <Link to="/browse">Explore items</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {savedItems.map((item) => {
          const action = cardAction({
            isMine: !!user && item.user_id === user.id,
            isRequested: !!requested?.has(item.id),
          });
          const rewards = itemRewardPoints(item);
          return (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-7 w-7" />
                    <span className="text-xs">No photo</span>
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-md bg-gold px-2.5 py-1 text-xs font-semibold text-gold-foreground">
                  {item.listing_type === "exchange" ? "EXCHANGE" : "FREE"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleWishlist(item.id, item.name)}
                  aria-label={`Remove ${item.name} from wishlist`}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-gold/60 bg-background/90 text-rose-600 shadow-sm transition-transform hover:scale-105"
                >
                  <Heart className="h-4 w-4 fill-current" />
                </button>
                <span className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-gold bg-primary text-gold">
                  <Recycle className="h-5 w-5" />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <h2 className="font-display text-xl font-bold leading-tight">{item.name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {conditionLabel(item.condition)}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <MapPin className="h-4 w-4" />
                    {item.location} · <span className="capitalize">{item.category}</span>
                  </span>
                </div>
                {item.listing_type === "exchange" && item.wants && (
                  <p className="text-xs font-medium text-gold-deep">Wants in exchange: {item.wants}</p>
                )}
                {item.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                )}
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Award className="h-3.5 w-3.5 text-gold-deep" />
                  Receiver +{rewards.receiver} pts · Donor +{rewards.donor} pts
                </p>
                <div className="mt-auto flex gap-2 border-t border-gold/45 pt-3">
                  {action === "mine" ? (
                    <Button variant="outline" className="flex-1" disabled>
                      Your item
                    </Button>
                  ) : action === "requested" ? (
                    <Button variant="secondary" className="flex-1" disabled>
                      <Check /> Requested
                    </Button>
                  ) : (
                    <Button
                      variant="request"
                      className="flex-1"
                      onClick={() => openRequest(item)}
                    >
                      {item.listing_type === "exchange" ? "Offer Exchange" : "Request"}
                      <ArrowRight className="ml-auto" />
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {requestItem && (
        <RequestDialog
          item={requestItem}
          open={!!requestItem}
          onOpenChange={(open) => !open && setRequestItem(null)}
        />
      )}
    </main>
  );
}
