import { z } from "zod";

export const itemCategories = [
  { value: "furniture", label: "Furniture" },
  { value: "clothes", label: "Clothes" },
  { value: "electronics", label: "Electronics" },
  { value: "books", label: "Books" },
  { value: "toys", label: "Toys" },
  { value: "other", label: "Other" },
] as const;

export const itemConditions = [
  { value: "new", label: "New" },
  { value: "good", label: "Good" },
  { value: "like_new", label: "Like New" },
  { value: "used", label: "Used" },
  { value: "needs_repair", label: "Needs Repair" },
] as const;

export const itemFormSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(100),
  category: z.enum(["furniture", "clothes", "electronics", "books", "toys", "other"], { message: "Pick a category" }),
  condition: z.enum(["new", "good", "like_new", "used", "needs_repair"], { message: "Pick an item condition" }),
  description: z.string().trim().max(1000),
  location: z.string().trim().min(1, "Location is required").max(100),
});

export const listingSchema = z.object({
  listing_type: z.enum(["give", "exchange"]).default("give"),
  wants: z.string().trim().max(200, "Keep your request under 200 characters").default(""),
});

export const requestMessageSchema = z.string().trim().max(500, "Keep your message under 500 characters");
export const chatMessageSchema = z.string().trim().min(1, "Enter a message").max(1000);

export function validatePhotos(files: Pick<File, "type" | "size">[]) {
  if (files.length < 1 || files.length > 5) return "Add between 1 and 5 photos";
  if (files.some((f) => !f.type.startsWith("image/"))) return "Photos must be images";
  if (files.some((f) => f.size > 5 * 1024 * 1024)) return "Each photo must be under 5MB";
  return null;
}

export const requestFormSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80, "Name is too long"),
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email is too long"),
});

export function formatRequestMessage(email: string, note?: string): string {
  const cleanEmail = email.trim();
  const cleanNote = (note ?? "").trim();
  const prefix = `Email: ${cleanEmail}`;
  if (!cleanNote) return prefix.slice(0, 500);
  const remaining = Math.max(0, 500 - prefix.length - 1);
  return remaining > 0 ? `${prefix}\n${cleanNote.slice(0, remaining)}` : prefix.slice(0, 500);
}

export function parseRequestMessage(raw: string): { email: string | null; note: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { email: null, note: "" };
  const match = /^Email:\s*([^\s\n]+@[^\s\n]+)(?:\n([\s\S]*))?$/i.exec(trimmed);
  if (match) {
    return {
      email: match[1] ?? null,
      note: (match[2] ?? "").trim(),
    };
  }
  return { email: null, note: trimmed };
}
