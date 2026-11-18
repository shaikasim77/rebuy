export type Coordinates = { latitude: number; longitude: number };

export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function itemDistance(
  item: { latitude: number | null; longitude: number | null },
  location: Coordinates | null,
) {
  return location && item.latitude !== null && item.longitude !== null
    ? distanceKm(location, { latitude: item.latitude, longitude: item.longitude })
    : null;
}

const CATEGORY_BASE_POINTS: Record<string, number> = {
  electronics: 20,
  furniture: 18,
  books: 12,
  clothes: 10,
  toys: 10,
  other: 8,
};

const CONDITION_BONUS_POINTS: Record<string, number> = {
  new: 6,
  like_new: 4,
  good: 2,
  used: 0,
  needs_repair: 0,
};

/**
 * Computes item-specific points based on category, condition, and listing type.
 * Receivers always earn more points than donors to reward giving items a second life.
 */
export function itemRewardPoints(item?: {
  category?: string | null;
  condition?: string | null;
  listing_type?: string | null;
} | null) {
  const base = CATEGORY_BASE_POINTS[item?.category ?? "other"] ?? 8;
  const bonus = CONDITION_BONUS_POINTS[item?.condition ?? "used"] ?? 0;
  const exchangeBonus = item?.listing_type === "exchange" ? 2 : 0;
  const donor = base + bonus + exchangeBonus;
  const receiver = donor + Math.max(6, Math.round(donor * 0.5));
  return { donor, receiver };
}

export function donorLevel(points: number) {
  if (points >= 300) return { name: "Guardian", start: 300, next: null };
  if (points >= 150) return { name: "Giver", start: 150, next: 300 };
  if (points >= 50) return { name: "Helper", start: 50, next: 150 };
  return { name: "Seedling", start: 0, next: 50 };
}

export function canTransition(isOwner: boolean, from: string, to: string) {
  return (
    isOwner &&
    ((from === "pending" && ["accepted", "declined"].includes(to)) ||
      (from === "accepted" && ["completed", "declined"].includes(to)))
  );
}

export function pageHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} – Rebuy` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} – Rebuy` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}