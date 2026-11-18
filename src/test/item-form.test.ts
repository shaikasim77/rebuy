import { describe, expect, it } from "vitest";
import { itemFormSchema } from "../lib/item-form";

const item = { name: "Chair", category: "furniture", condition: "used", description: "", location: "Hyderabad" };

describe("item posting options", () => {
  it("accepts exactly the six requested categories", () => {
    for (const category of ["furniture", "clothes", "electronics", "books", "toys", "other"]) {
      expect(itemFormSchema.safeParse({ ...item, category }).success).toBe(true);
    }
    expect(itemFormSchema.safeParse({ ...item, category: "vehicles" }).success).toBe(false);
  });
  it("accepts exactly the four requested conditions", () => {
    for (const condition of ["new", "like_new", "used", "needs_repair"]) {
      expect(itemFormSchema.safeParse({ ...item, condition }).success).toBe(true);
    }
    expect(itemFormSchema.safeParse({ ...item, condition: "" }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...item, condition: "damaged" }).success).toBe(false);
  });
  it("rejects blank names and locations and oversized text", () => {
    expect(itemFormSchema.safeParse({ ...item, name: " " }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...item, location: " " }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...item, name: "x".repeat(101) }).success).toBe(false);
    expect(itemFormSchema.safeParse({ ...item, description: "x".repeat(1001) }).success).toBe(false);
  });
});
import { formatRequestMessage, parseRequestMessage, requestFormSchema } from "@/lib/item-form";
import { itemRewardPoints } from "@/lib/rebuy";

describe("request form", () => {
  it("accepts name + email and rejects invalid email or blank name", () => {
    expect(requestFormSchema.safeParse({ name: "Asim", email: "asim@example.com" }).success).toBe(true);
    expect(requestFormSchema.safeParse({ name: "Asim", email: "not-an-email" }).success).toBe(false);
    expect(requestFormSchema.safeParse({ name: " ", email: "asim@example.com" }).success).toBe(false);
  });

  it("formats and parses email and optional note cleanly", () => {
    const packed = formatRequestMessage("asim@example.com", "Can pick up tomorrow evening");
    expect(parseRequestMessage(packed)).toEqual({
      email: "asim@example.com",
      note: "Can pick up tomorrow evening",
    });
  });
});

describe("item-based reward points", () => {
  it("varies points by item category, condition, and listing type", () => {
    const laptopNew = itemRewardPoints({ category: "electronics", condition: "new", listing_type: "exchange" });
    const clothesUsed = itemRewardPoints({ category: "clothes", condition: "used", listing_type: "give" });
    expect(laptopNew.donor).toBeGreaterThan(clothesUsed.donor);
    expect(laptopNew.receiver).toBeGreaterThan(clothesUsed.receiver);
  });

  it("always awards more points to receivers than donors", () => {
    for (const category of ["electronics", "furniture", "books", "clothes", "toys", "other"]) {
      for (const condition of ["new", "like_new", "used", "needs_repair"]) {
        const rewards = itemRewardPoints({ category, condition, listing_type: "give" });
        expect(rewards.receiver).toBeGreaterThan(rewards.donor);
      }
    }
  });
});

