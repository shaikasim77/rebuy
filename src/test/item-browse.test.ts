import { describe, expect, it } from "vitest";
import {
  browseFilterCategories,
  cardAction,
  filterItems,
  matchesQuery,
} from "../lib/item-browse";
import { itemShareUrl, itemWhatsAppShareUrl } from "../lib/share";
import { formatHandoverReviewMessage, parseHandoverReviewMessage } from "../lib/trust";

const items = [
  {
    name: "Wooden Chair",
    description: "Solid teak",
    location: "Tirupathi",
    category: "furniture",
    condition: "used",
    listing_type: "give",
    latitude: 17.385,
    longitude: 78.4867,
  },
  {
    name: "Hand bag",
    description: "Gently used",
    location: "Tirupathi",
    category: "clothes",
    condition: "like_new",
    listing_type: "give",
    latitude: 17.39,
    longitude: 78.49,
  },
  {
    name: "Old Radio",
    description: "Needs repair",
    location: "VIZAG",
    category: "electronics",
    condition: "needs_repair",
    listing_type: "exchange",
    latitude: 17.6868,
    longitude: 83.2185,
  },
  { name: "Tamil Story Book", description: "Hardcover", location: "Vizag", category: "books", condition: "new", listing_type: "give" },
  { name: "Cycle", description: "Works well", location: "Hyderabad", category: "toys", condition: "good", listing_type: "exchange" },
  { name: "Sofa set", description: "Needs repair", location: "Chennai", category: "furniture", condition: "needs_repair", listing_type: "give" },
];

describe("browse filters", () => {
  it("offers exactly All plus the five requested category chips", () => {
    expect([...browseFilterCategories]).toEqual([
      "all",
      "furniture",
      "clothes",
      "electronics",
      "books",
      "toys",
    ]);
  });

  it("keeps only the selected category", () => {
    expect(
      filterItems(items, { query: "", category: "furniture" }).map((i) => i.name),
    ).toEqual(["Wooden Chair", "Sofa set"]);
  });

  it("searches name, description and location, ignoring case", () => {
    expect(filterItems(items, { query: "chair", category: "all" })).toHaveLength(1);
    expect(filterItems(items, { query: "needs repair", category: "all" })).toHaveLength(2);
    expect(filterItems(items, { query: "vizag", category: "all" })).toHaveLength(2);
    expect(
      matchesQuery(
        { name: "Wooden Chair", description: "Solid teak", location: "Tirupathi", category: "furniture" },
        "  TEAK  ",
      ),
    ).toBe(true);
  });

  it("combines the search box with the category chip", () => {
    expect(
      filterItems(items, { query: "repair", category: "furniture" }).map((i) => i.name),
    ).toEqual(["Sofa set"]);
    expect(filterItems(items, { query: "repair", category: "books" })).toHaveLength(0);
  });

  it("filters by condition, listing type, and distance radius", () => {
    expect(filterItems(items, { query: "", category: "all", condition: "like_new" }).map((i) => i.name)).toEqual([
      "Hand bag",
    ]);
    expect(filterItems(items, { query: "", category: "all", listingType: "exchange" }).map((i) => i.name)).toEqual([
      "Old Radio",
      "Cycle",
    ]);
    expect(
      filterItems(items, {
        query: "",
        category: "all",
        radiusKm: 5,
        location: { latitude: 17.385, longitude: 78.4867 },
      }).map((i) => i.name),
    ).toEqual(["Wooden Chair", "Hand bag"]);
  });

  it("returns everything for an empty search on All", () => {
    expect(filterItems(items, { query: "   ", category: "all" })).toHaveLength(items.length);
  });

  it("shows your own item first, then a request you already sent, then the request button", () => {
    expect(cardAction({ isMine: true, isRequested: false })).toBe("mine");
    expect(cardAction({ isMine: true, isRequested: true })).toBe("mine");
    expect(cardAction({ isMine: false, isRequested: true })).toBe("requested");
    expect(cardAction({ isMine: false, isRequested: false })).toBe("request");
  });
});

describe("handover reviews and sharing helpers", () => {
  it("formats and parses handover reviews cleanly", () => {
    const raw = formatHandoverReviewMessage({
      stars: 5,
      tags: ["On-time pickup", "Smooth handover"],
      note: "Thanks a lot!",
    });
    expect(parseHandoverReviewMessage(raw)).toEqual({
      stars: 5,
      tags: ["On-time pickup", "Smooth handover"],
      note: "Thanks a lot!",
    });
    expect(parseHandoverReviewMessage("Regular chat message")).toBeNull();
  });

  it("builds direct item link and WhatsApp share URL", () => {
    expect(itemShareUrl("item-123")).toContain("/browse?item=item-123");
    const wa = itemWhatsAppShareUrl({
      id: "item-123",
      name: "Study Chair",
      location: "Hyderabad",
      listing_type: "give",
    });
    expect(wa).toContain("https://wa.me/?text=");
    expect(wa).toContain("Study%20Chair");
  });
});
