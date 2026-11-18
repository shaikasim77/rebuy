import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "./use-auth";

const STORAGE_PREFIX = "rebuy:wishlist:";

function readIds(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore storage quota errors
  }
}

type WishlistContextValue = {
  wishlistIds: string[];
  wishlistSet: Set<string>;
  count: number;
  isWishlisted: (itemId: string) => boolean;
  toggleWishlist: (itemId: string, itemName?: string) => void;
  removeFromWishlist: (itemId: string) => void;
  clearWishlist: () => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = `${STORAGE_PREFIX}${user?.id ?? "guest"}`;
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    const userIds = readIds(storageKey);
    if (user?.id) {
      const guestKey = `${STORAGE_PREFIX}guest`;
      const guestIds = readIds(guestKey);
      if (guestIds.length > 0) {
        const merged = [...new Set([...guestIds, ...userIds])];
        writeIds(storageKey, merged);
        writeIds(guestKey, []);
        setWishlistIds(merged);
        return;
      }
    }
    setWishlistIds(userIds);
  }, [storageKey, user?.id]);

  const wishlistSet = useMemo(() => new Set(wishlistIds), [wishlistIds]);

  const isWishlisted = useCallback((itemId: string) => wishlistSet.has(itemId), [wishlistSet]);

  const toggleWishlist = useCallback(
    (itemId: string, itemName?: string) => {
      setWishlistIds((prev) => {
        const exists = prev.includes(itemId);
        const next = exists ? prev.filter((id) => id !== itemId) : [itemId, ...prev];
        writeIds(storageKey, next);
        toast.success(
          exists
            ? `Removed${itemName ? ` "${itemName}"` : ""} from wishlist`
            : `Saved${itemName ? ` "${itemName}"` : ""} to wishlist`,
        );
        return next;
      });
    },
    [storageKey],
  );

  const removeFromWishlist = useCallback(
    (itemId: string) => {
      setWishlistIds((prev) => {
        const next = prev.filter((id) => id !== itemId);
        writeIds(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const clearWishlist = useCallback(() => {
    setWishlistIds([]);
    writeIds(storageKey, []);
    toast.success("Wishlist cleared");
  }, [storageKey]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      wishlistIds,
      wishlistSet,
      count: wishlistIds.length,
      isWishlisted,
      toggleWishlist,
      removeFromWishlist,
      clearWishlist,
    }),
    [wishlistIds, wishlistSet, isWishlisted, toggleWishlist, removeFromWishlist, clearWishlist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }
  return ctx;
}
