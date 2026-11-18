import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchItems } from "@/lib/available-items";
import { fetchRequests } from "@/lib/requests";
import { parseRequestMessage } from "@/lib/item-form";
import { itemRewardPoints } from "@/lib/rebuy";
import { useAuth } from "./use-auth";
import { itemMatchesWatchAlert, useWatchAlerts } from "./use-watch-alerts";

export type AppNotification = {
  id: string;
  requestId: string;
  itemId?: string;
  kind: "incoming_request" | "status_update" | "watch_match";
  title: string;
  body: string;
  requesterEmail: string | null;
  status: string;
  createdAt: string;
  unread: boolean;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const READ_PREFIX = "rebuy:read-notifs:";

function readSeenSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenSet(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-200)));
  } catch {
    // ignore storage quota errors
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { alerts } = useWatchAlerts();
  const qc = useQueryClient();
  const readKey = `${READ_PREFIX}${user?.id ?? "anon"}`;
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const toastedRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    setReadIds(user ? readSeenSet(readKey) : new Set());
    initializedRef.current = false;
    toastedRef.current = new Set();
  }, [readKey, user]);

  const { data: requests = [] } = useQuery({
    queryKey: ["requests", user?.id],
    queryFn: () => fetchRequests(user!.id),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: availableItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
    enabled: alerts.length > 0,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`rebuy-notifs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `owner_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["requests", user.id] });
          qc.invalidateQueries({ queryKey: ["my-points-summary", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "requests", filter: `requester_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["requests", user.id] });
          qc.invalidateQueries({ queryKey: ["my-points-summary", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const notifications = useMemo<AppNotification[]>(() => {
    if (!user) return [];
    const list: AppNotification[] = [];
    for (const r of requests) {
      const itemName = r.item?.name ?? "an item";
      const parsed = parseRequestMessage(r.message);
      const rewards = itemRewardPoints(r.item);
      if (r.owner_id === user.id) {
        const id = `req-in:${r.id}:${r.status}`;
        const sender = r.requester_name || r.requester?.display_name || "Someone";
        const title =
          r.status === "pending"
            ? `New request for "${itemName}"`
            : r.status === "completed"
              ? `Handover completed for "${itemName}" (+${rewards.donor} pts)`
              : `Request for "${itemName}" (${r.status})`;
        const body = parsed.email
          ? `${sender} (${parsed.email}) requested this item`
          : `${sender} requested this item`;
        list.push({
          id,
          requestId: r.id,
          kind: "incoming_request",
          title,
          body,
          requesterEmail: parsed.email,
          status: r.status,
          createdAt: r.updated_at || r.created_at,
          unread: !readIds.has(id) && r.status === "pending",
        });
      } else if (r.requester_id === user.id && r.status !== "pending") {
        const id = `req-out:${r.id}:${r.status}`;
        const ownerName = r.owner?.display_name || "The donor";
        const title =
          r.status === "accepted"
            ? `${ownerName} accepted your request for "${itemName}"`
            : r.status === "completed"
              ? `Handover completed for "${itemName}" (+${rewards.receiver} pts)`
              : `Request for "${itemName}" was declined`;
        list.push({
          id,
          requestId: r.id,
          kind: "status_update",
          title,
          body: r.status === "accepted" ? "Open My Requests to coordinate pickup." : "View details in My Requests.",
          requesterEmail: null,
          status: r.status,
          createdAt: r.updated_at || r.created_at,
          unread: !readIds.has(id),
        });
      }
    }
    if (alerts.length > 0 && availableItems.length > 0) {
      const seenItemIds = new Set<string>();
      for (const alert of alerts) {
        for (const item of availableItems) {
          if (seenItemIds.has(item.id)) continue;
          if (itemMatchesWatchAlert(item, alert, user.id)) {
            seenItemIds.add(item.id);
            const id = `watch:${alert.id}:${item.id}`;
            list.push({
              id,
              requestId: "",
              itemId: item.id,
              kind: "watch_match",
              title: `Match for Looking For: "${item.name}"`,
              body: `${item.location} · ${item.category} (${item.listing_type === "exchange" ? "Exchange" : "Free"})`,
              requesterEmail: null,
              status: "match",
              createdAt: item.created_at,
              unread: !readIds.has(id),
            });
          }
        }
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, user, readIds, alerts, availableItems]);

  // Toast newly arriving unread notifications after initial load
  useEffect(() => {
    if (!user || !requests) return;
    if (!initializedRef.current) {
      notifications.forEach((n) => toastedRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }
    for (const n of notifications) {
      if (n.unread && !toastedRef.current.has(n.id)) {
        toastedRef.current.add(n.id);
        toast.info(n.title, { description: n.body });
      }
    }
  }, [notifications, requests, user]);

  const markAsRead = useCallback(
    (notificationId: string) => {
      if (!user) return;
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(notificationId);
        writeSeenSet(readKey, next);
        return next;
      });
    },
    [readKey, user],
  );

  const markAllAsRead = useCallback(() => {
    if (!user) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      writeSeenSet(readKey, next);
      return next;
    });
  }, [notifications, readKey, user]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead }),
    [notifications, unreadCount, markAsRead, markAllAsRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
