import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "./use-auth";

export interface WatchAlert {
  id: string;
  keyword: string;
  category: string;
  createdAt: string;
}

const STORAGE_PREFIX = "rebuy:watch-alerts:";

function readAlerts(key: string): WatchAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchAlert[]) : [];
  } catch {
    return [];
  }
}

export function itemMatchesWatchAlert(
  item: { name: string; description: string; location: string; category: string; user_id: string },
  alert: WatchAlert,
  currentUserId?: string,
) {
  if (currentUserId && item.user_id === currentUserId) return false;
  if (alert.category !== "all" && item.category !== alert.category) return false;
  const kw = alert.keyword.trim().toLowerCase();
  if (!kw) return true;
  return [item.name, item.description, item.location].some((f) => f.toLowerCase().includes(kw));
}

type WatchAlertsContextValue = {
  alerts: WatchAlert[];
  addAlert: (keyword: string, category: string) => boolean;
  removeAlert: (id: string) => void;
};

const WatchAlertsContext = createContext<WatchAlertsContextValue | null>(null);

export function WatchAlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = `${STORAGE_PREFIX}${user?.id ?? "guest"}`;
  const [alerts, setAlerts] = useState<WatchAlert[]>(() => readAlerts(storageKey));

  useEffect(() => {
    setAlerts(readAlerts(storageKey));
  }, [storageKey]);

  const persist = useCallback(
    (next: WatchAlert[]) => {
      setAlerts(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore quota errors
        }
      }
    },
    [storageKey],
  );

  const addAlert = useCallback(
    (keyword: string, category: string) => {
      const cleanKeyword = keyword.trim().slice(0, 60);
      if (!cleanKeyword && category === "all") {
        toast.error("Enter a keyword or choose a specific category to watch.");
        return false;
      }
      const duplicate = alerts.some(
        (a) => a.category === category && a.keyword.toLowerCase() === cleanKeyword.toLowerCase(),
      );
      if (duplicate) {
        toast.info("You already have this Looking For alert saved.");
        return false;
      }
      const next: WatchAlert[] = [
        {
          id: crypto.randomUUID(),
          keyword: cleanKeyword,
          category,
          createdAt: new Date().toISOString(),
        },
        ...alerts,
      ].slice(0, 10);
      persist(next);
      toast.success("Looking For alert saved! We'll notify you when matching items appear.");
      return true;
    },
    [alerts, persist],
  );

  const removeAlert = useCallback(
    (id: string) => {
      persist(alerts.filter((a) => a.id !== id));
      toast.success("Alert removed.");
    },
    [alerts, persist],
  );

  const value = useMemo(
    () => ({ alerts, addAlert, removeAlert }),
    [alerts, addAlert, removeAlert],
  );

  return <WatchAlertsContext.Provider value={value}>{children}</WatchAlertsContext.Provider>;
}

export function useWatchAlerts() {
  const ctx = useContext(WatchAlertsContext);
  if (!ctx) {
    throw new Error("useWatchAlerts must be used within WatchAlertsProvider");
  }
  return ctx;
}
