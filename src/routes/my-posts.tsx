import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  EyeOff,
  ImageOff,
  Inbox,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EditItemDialog, type EditableItem } from "@/components/EditItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyPointsSummary } from "@/lib/community";
import { itemConditions } from "@/lib/item-form";
import { donorLevel, itemRewardPoints } from "@/lib/rebuy";
import { fetchRequests } from "@/lib/requests";

export const Route = createFileRoute("/my-posts")({
  head: () => ({
    meta: [
      { title: "My Posts – Rebuy" },
      { name: "description", content: "See and manage the items you posted on Rebuy." },
      { property: "og:title", content: "My Posts – Rebuy" },
      { property: "og:description", content: "See and manage the items you posted on Rebuy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyPosts,
});

async function fetchMyItems(userId: string) {
  const { data, error } = await supabase
    .from("items")
    .select("*, item_photos(storage_path, sort_order)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const paths = data.map((i) => i.photo_url).filter((p): p is string => !!p);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("item-photos").createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    });
  }
  return data.map((i) => ({ ...i, image: i.photo_url ? urls[i.photo_url] : undefined }));
}

function conditionLabel(condition: string) {
  return itemConditions.find((c) => c.value === condition)?.label ?? condition;
}

function MyPosts() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ item: EditableItem; hasRequests: boolean } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-items", user?.id],
    queryFn: () => fetchMyItems(user!.id),
    enabled: !!user,
  });

  const { data: pointsSummary } = useQuery({
    queryKey: ["my-points-summary", user?.id],
    queryFn: () => fetchMyPointsSummary(user!.id),
    enabled: !!user,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ["requests", user?.id],
    queryFn: () => fetchRequests(user!.id),
    enabled: !!user,
  });

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Loading...</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <h1 className="font-display text-2xl font-bold">Log in to see your posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your posted items and personal points will show up here.
          </p>
          <Button asChild className="mt-5">
            <Link to="/login" search={{ redirect: "/my-posts" }}>Login</Link>
          </Button>
        </div>
      </main>
    );
  }

  const points = pointsSummary?.totalPoints ?? 0;
  const donorPoints = pointsSummary?.donorPoints ?? 0;
  const receiverPoints = pointsSummary?.receiverPoints ?? 0;
  const givenCount = pointsSummary?.givenCount ?? 0;
  const receivedCount = pointsSummary?.receivedCount ?? 0;
  const entries = pointsSummary?.entries ?? [];
  const level = donorLevel(points);
  const progressPct = level.next
    ? Math.min(100, Math.round(((points - level.start) / (level.next - level.start)) * 100))
    : 100;

  const toggleAvailability = async (itemId: string, nextAvailable: boolean) => {
    setBusyId(itemId);
    const { error: upErr } = await supabase
      .from("items")
      .update({ is_available: nextAvailable })
      .eq("id", itemId);
    setBusyId(null);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["my-items", user.id] }),
      qc.invalidateQueries({ queryKey: ["items"] }),
    ]);
    toast.success(nextAvailable ? "Item marked available again" : "Item marked unavailable");
  };

  const deleteItem = async (itemId: string, itemName: string) => {
    setBusyId(itemId);
    const { error: delErr } = await supabase.from("items").delete().eq("id", itemId);
    setBusyId(null);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["my-items", user.id] }),
      qc.invalidateQueries({ queryKey: ["items"] }),
      qc.invalidateQueries({ queryKey: ["community"] }),
    ]);
    toast.success(`Deleted "${itemName}"`);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">My Posts & Personal Points</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage everything you've shared on Rebuy and track your private account points.
          </p>
        </div>
        <Button asChild>
          <Link to="/post">
            <Plus /> Post an Item
          </Link>
        </Button>
      </div>

      {/* Private Personal Points & Level Card (only visible in your own account) */}
      <section className="grid gap-6 rounded-2xl border border-gold/50 bg-card p-6 shadow-soft lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold bg-accent text-gold-deep">
                <Award className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-deep">
                  Personal Level: {level.name} · Private to your account
                </p>
                <p className="font-display text-3xl font-bold text-foreground">{points} Points</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-border bg-background px-3.5 py-2 text-right">
                <p className="text-[11px] text-muted-foreground">Donor ({givenCount})</p>
                <p className="font-display text-lg font-bold text-primary">+{donorPoints} pts</p>
              </div>
              <div className="rounded-xl border border-gold/40 bg-accent/50 px-3.5 py-2 text-right">
                <p className="text-[11px] text-muted-foreground">Receiver ({receivedCount})</p>
                <p className="font-display text-lg font-bold text-gold-deep">+{receiverPoints} pts</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{level.name}</span>
              <span>
                {level.next ? `${level.next - points} pts to next level` : "Top Guardian tier reached!"}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Points vary by item category, condition, and listing type — and receivers earn higher
            points than donors on every completed handover in{" "}
            <Link to="/my-requests" className="font-semibold text-primary underline">
              My Requests
            </Link>
            .
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <p className="font-display text-base font-semibold">Your Item Points History</p>
          {entries.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No points earned yet. Complete an item handover (as donor or receiver) to earn
              item-based points!
            </p>
          ) : (
            <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 text-xs">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                  <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gold-deep" />
                    <span className="truncate font-medium">{entry.itemName}</span>
                    <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold capitalize text-primary">
                      {entry.role}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-primary">+{entry.points} pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isLoading && <p className="text-muted-foreground">Loading your items...</p>}
      {error && <p className="text-destructive">Couldn't load your items.</p>}

      {!isLoading && !error && data && data.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <p className="font-display text-xl font-bold">You haven't posted anything yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Share something you no longer need.</p>
          <Button asChild className="mt-5">
            <Link to="/post">Post your first item</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((item) => {
          const itemReqs = allRequests.filter((r) => r.item_id === item.id && r.owner_id === user.id);
          const pendingCount = itemReqs.filter((r) => r.status === "pending" || r.status === "accepted").length;
          const rewards = itemRewardPoints(item);

          return (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-7 w-7" />
                    <span className="text-xs">No photo</span>
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-md bg-gold px-2.5 py-1 text-xs font-semibold text-gold-foreground">
                  {item.listing_type === "exchange" ? "EXCHANGE" : "FREE"}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-bold leading-tight">{item.name}</h2>
                  <Badge className="shrink-0 capitalize">{item.category}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    {conditionLabel(item.condition)}
                  </span>
                  <span className="flex items-center gap-1 text-primary">
                    <MapPin className="h-4 w-4" />
                    {item.location}
                  </span>
                </div>
                <p className="text-xs font-medium text-gold-deep">
                  Handover reward: Donor +{rewards.donor} pts · Receiver +{rewards.receiver} pts
                </p>
                {item.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                )}

                <div className="mt-auto space-y-3 border-t border-gold/45 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    {item.is_available ? (
                      <span className="font-semibold text-primary">Available</span>
                    ) : (
                      <span className="font-medium text-muted-foreground">No longer available</span>
                    )}
                    {pendingCount > 0 && (
                      <Link
                        to="/my-requests"
                        className="inline-flex items-center gap-1 font-semibold text-gold-deep hover:underline"
                      >
                        <Inbox className="h-3.5 w-3.5" />
                        {pendingCount} active {pendingCount === 1 ? "request" : "requests"}
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() =>
                        setEditingTarget({
                          item: {
                            id: item.id,
                            user_id: item.user_id,
                            name: item.name,
                            category: item.category,
                            condition: item.condition,
                            description: item.description,
                            location: item.location,
                            listing_type: item.listing_type,
                            wants: item.wants,
                            latitude: item.latitude,
                            longitude: item.longitude,
                            photo_url: item.photo_url,
                          },
                          hasRequests: itemReqs.length > 0,
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={busyId === item.id}
                      onClick={() => toggleAvailability(item.id, !item.is_available)}
                    >
                      {item.is_available ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Mark Unavailable
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3.5 w-3.5" />
                          Relist
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={busyId === item.id}
                      onClick={() => deleteItem(item.id, item.name)}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <EditItemDialog
        item={editingTarget?.item ?? null}
        hasRequests={editingTarget?.hasRequests ?? false}
        open={!!editingTarget}
        onOpenChange={(open) => !open && setEditingTarget(null)}
      />
    </main>
  );
}
