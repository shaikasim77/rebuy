import { itemCategories, itemConditions } from "./item-form";
import { itemDistance, type Coordinates } from "./rebuy";

export type BrowseCategory = (typeof browseFilterCategories)[number];
export type BrowseCondition = "all" | (typeof itemConditions)[number]["value"];
export type BrowseRadiusKm = 0 | 5 | 10 | 25;

/**
 * Filter chips shown on the Browse page: "All" plus the item categories the
 * chips were requested for. Kept here so the page and its tests agree.
 */
export const browseFilterCategories = [
  "all",
  "furniture",
  "clothes",
  "electronics",
  "books",
  "toys",
] as const;

export function browseCategoryLabel(value: BrowseCategory) {
  if (value === "all") return "All";
  return itemCategories.find((c) => c.value === value)?.label ?? value;
}

export function browseConditionLabel(value: BrowseCondition) {
  if (value === "all") return "All Conditions";
  return itemConditions.find((c) => c.value === value)?.label ?? value;
}

export interface FilterableItem {
  name: string;
  description: string;
  location: string;
  category: string;
  condition?: string;
  listing_type?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** Case-insensitive text match across name, description and location. */
export function matchesQuery(item: FilterableItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.name, item.description, item.location].some((field) =>
    field.toLowerCase().includes(q),
  );
}

export function filterItems<T extends FilterableItem>(
  items: T[],
  {
    query,
    category,
    condition = "all",
    listingType = "all",
    radiusKm = 0,
    location = null,
  }: {
    query: string;
    category: BrowseCategory;
    condition?: BrowseCondition;
    listingType?: "all" | "give" | "exchange";
    radiusKm?: BrowseRadiusKm;
    location?: Coordinates | null;
  },
): T[] {
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (condition !== "all" && item.condition !== condition) return false;
    if (listingType !== "all" && item.listing_type !== listingType) return false;
    if (!matchesQuery(item, query)) return false;
    if (radiusKm > 0 && location) {
      const dist = itemDistance(
        { latitude: item.latitude ?? null, longitude: item.longitude ?? null },
        location,
      );
      if (dist === null || dist > radiusKm) return false;
    }
    return true;
  });
}

export type CardAction = "mine" | "requested" | "request";

/** Which action a card's button shows: your own item, one you already asked for, or requestable. */
export function cardAction({
  isMine,
  isRequested,
}: {
  isMine: boolean;
  isRequested: boolean;
}): CardAction {
  if (isMine) return "mine";
  if (isRequested) return "requested";
  return "request";
}
