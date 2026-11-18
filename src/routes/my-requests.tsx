import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Check,
  CheckCircle2,
  Inbox,
  Mail,
  MessageSquare,
  Send,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { HandoverReviewDialog } from "@/components/HandoverReviewDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { supabase } from "@/integrations/supabase/client";
import { chatMessageSchema, parseRequestMessage } from "@/lib/item-form";
import { itemRewardPoints } from "@/lib/rebuy";
import { parseHandoverReviewMessage } from "@/lib/trust";
import {
  cancelPendingRequest,
  fetchLegacyRequestsForMyItems,
  fetchRequestMessages,
  fetchRequests,
  sendRequestMessage,
  updateRequestStatus,
} from "@/lib/requests";

export const Route = createFileRoute("/my-requests")({
  head: () => ({
    meta: [
      { title: "My Requests – Rebuy" },
      { name: "description", content: "Manage incoming and sent item requests on Rebuy." },
      { property: "og:title", content: "My Requests – Rebuy" },
      { property: "og:description", content: "Manage incoming and sent item requests on Rebuy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyRequests,
});

function RequestChat({ requestId, userId }: { requestId: string; userId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["request-messages", requestId],
    queryFn: () => fetchRequestMessages(requestId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`req-chat-${requestId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `request_id=eq.${requestId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["request-messages", requestId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, qc]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = chatMessageSchema.safeParse(text);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a message");
      return;
    }
    setSending(true);
    try {
      await sendRequestMessage(requestId, userId, parsed.data);
      setText("");
      await qc.invalidateQueries({ queryKey: ["request-messages", requestId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-3">
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-muted-foreground">Loading messages...</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-muted-foreground">No messages yet. Say hello to arrange pickup!</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          const review = parseHandoverReviewMessage(m.body);
          if (review) {
            return (
              <div
                key={m.id}
                className="rounded-xl border border-gold/50 bg-accent/70 p-2.5 text-xs text-foreground"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-primary">
                    {mine ? "Your Handover Review" : "Partner Handover Review"}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-semibold text-gold-deep">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold-deep" />
                    {review.stars}/5
                  </span>
                </div>
                {review.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {review.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-medium text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {review.note && <p className="mt-1.5 italic text-foreground">"{review.note}"</p>}
              </div>
            );
          }
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <p>{m.body}</p>
              <p className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          maxLength={1000}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" className="h-8 px-3" disabled={sending}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

function MyRequests() {
  const { user, loading } = useAuth();
  const { markAllAsRead } = useNotifications();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"incoming" | "sent">("incoming");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{
    requestId: string;
    itemName: string;
    partnerName: string;
  } | null>(null);

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["requests", user?.id],
    queryFn: () => fetchRequests(user!.id),
    enabled: !!user,
  });

  const { data: legacy = [] } = useQuery({
    queryKey: ["legacy-requests", user?.id],
    queryFn: () => fetchLegacyRequestsForMyItems(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && requests.length > 0) {
      markAllAsRead();
    }
  }, [user, requests.length, markAllAsRead]);

  if (loading) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading...</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <h1 className="font-display text-2xl font-bold">Log in to see your requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Requests for your items and items you requested will show up here.</p>
          <Button asChild className="mt-5">
            <Link to="/login" search={{ redirect: "/my-requests" }}>Login</Link>
          </Button>
        </div>
      </main>
    );
  }

  const incoming = requests.filter((r) => r.owner_id === user.id);
  const sent = requests.filter((r) => r.requester_id === user.id);
  const activeList = tab === "incoming" ? incoming : sent;

  const handleTransition = async (
    requestId: string,
    status: "accepted" | "declined" | "completed",
  ) => {
    setBusyId(requestId);
    const targetReq = requests.find((r) => r.id === requestId);
    const rewards = itemRewardPoints(targetReq?.item);
    try {
      await updateRequestStatus(requestId, status);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requests", user.id] }),
        qc.invalidateQueries({ queryKey: ["items"] }),
        qc.invalidateQueries({ queryKey: ["my-items", user.id] }),
        qc.invalidateQueries({ queryKey: ["my-points-summary", user.id] }),
        qc.invalidateQueries({ queryKey: ["community"] }),
      ]);
      if (status === "completed") {
        toast.success(
          `Handover completed! You earned +${rewards.donor} donor pts (receiver earned +${rewards.receiver} pts).`,
        );
      } else if (status === "accepted") {
        toast.success("Request accepted! Coordinate pickup via email or chat.");
      } else {
        toast.success("Request declined.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update request");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setBusyId(requestId);
    try {
      await cancelPendingRequest(requestId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requests", user.id] }),
        qc.invalidateQueries({ queryKey: ["requested-items", user.id] }),
      ]);
      toast.success("Request cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel request");
    } finally {
      setBusyId(null);
    }
  };

  const statusBadgeVariant = (status: string) => {
    if (status === "completed") return "default" as const;
    if (status === "accepted") return "secondary" as const;
    if (status === "declined") return "outline" as const;
    return "outline" as const;
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">My Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accept requests, email or chat to arrange pickup, and complete handovers to earn
            item-based points (receivers earn even more!).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "incoming" ? "default" : "outline"}
            onClick={() => setTab("incoming")}
          >
            Incoming ({incoming.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "sent" ? "default" : "outline"}
            onClick={() => setTab("sent")}
          >
            Sent ({sent.length})
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading requests...</p>}
      {error && <p className="text-destructive">Couldn't load requests.</p>}

      {!isLoading && !error && activeList.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-display text-xl font-bold">
            {tab === "incoming" ? "No incoming requests yet" : "You haven't requested any items yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "incoming"
              ? "When someone requests one of your posted items, their name, email, and message will appear here."
              : "Browse items shared nearby and send a request."}
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to={tab === "incoming" ? "/my-posts" : "/browse"}>
              {tab === "incoming" ? "See my posts" : "Browse items"}
            </Link>
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {activeList.map((req) => {
          const parsed = parseRequestMessage(req.message);
          const isIncoming = req.owner_id === user.id;
          const chatOpen = openChatId === req.id;
          const rewards = itemRewardPoints(req.item);

          return (
            <article
              key={req.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold leading-tight">
                      {req.item?.name ?? "Item"}
                    </h2>
                    {req.item?.category && (
                      <Badge className="capitalize">{req.item.category}</Badge>
                    )}
                    <Badge variant={statusBadgeVariant(req.status)} className="capitalize">
                      {req.status}
                    </Badge>
                  </div>

                  {req.offer && (
                    <p className="text-xs font-medium text-gold-deep">
                      Exchange offer: {req.offer.name}
                    </p>
                  )}

                  {parsed.note && (
                    <p className="text-sm text-foreground">"{parsed.note}"</p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 text-sm sm:items-end">
                  <span className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4 text-primary" />
                    {isIncoming
                      ? req.requester_name || req.requester?.display_name || "Requester"
                      : `Donor: ${req.owner?.display_name || "Member"}`}
                  </span>
                  {isIncoming && parsed.email && (
                    <a
                      href={`mailto:${parsed.email}?subject=${encodeURIComponent(`Rebuy: ${req.item?.name ?? "Your request"}`)}`}
                      className="flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {parsed.email}
                    </a>
                  )}
                  {req.status === "completed" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-deep">
                      <Award className="h-3.5 w-3.5" />
                      {isIncoming
                        ? `+${rewards.donor} donor pts awarded`
                        : `+${rewards.receiver} receiver pts awarded`}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gold/30 pt-3">
                {isIncoming && req.status === "pending" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === req.id}
                      onClick={() => handleTransition(req.id, "accepted")}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === req.id}
                      onClick={() => handleTransition(req.id, "declined")}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </>
                )}

                {isIncoming && req.status === "accepted" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === req.id}
                      onClick={() => handleTransition(req.id, "completed")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete Handover (+{rewards.donor} donor / +{rewards.receiver} receiver pts)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === req.id}
                      onClick={() => handleTransition(req.id, "declined")}
                    >
                      Decline
                    </Button>
                  </>
                )}

                {!isIncoming && req.status === "pending" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === req.id}
                    onClick={() => handleCancel(req.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancel Request
                  </Button>
                )}

                {req.status === "completed" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setReviewTarget({
                        requestId: req.id,
                        itemName: req.item?.name ?? "Item",
                        partnerName: isIncoming
                          ? req.requester_name || req.requester?.display_name || "Receiver"
                          : req.owner?.display_name || "Donor",
                      })
                    }
                  >
                    <Star className="h-4 w-4 text-gold-deep" />
                    Rate & Thank
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setOpenChatId(chatOpen ? null : req.id)}
                >
                  <MessageSquare className="h-4 w-4" />
                  {chatOpen ? "Hide Chat" : "Message"}
                </Button>
              </div>

              {chatOpen && <RequestChat requestId={req.id} userId={user.id} />}
            </article>
          );
        })}
      </div>

      {tab === "incoming" && legacy.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="font-display text-lg font-semibold text-muted-foreground">
            Earlier Requests History
          </h2>
          {legacy.map((req) => (
            <article
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-semibold">{req.items.name}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  · {new Date(req.created_at).toLocaleDateString()}
                </span>
              </div>
              <span className="text-muted-foreground">
                From: {req.requester_name || "Member"}
              </span>
            </article>
          ))}
        </section>
      )}

      {reviewTarget && (
        <HandoverReviewDialog
          requestId={reviewTarget.requestId}
          userId={user.id}
          itemName={reviewTarget.itemName}
          partnerName={reviewTarget.partnerName}
          open={!!reviewTarget}
          onOpenChange={(open) => !open && setReviewTarget(null)}
        />
      )}
    </main>
  );
}
