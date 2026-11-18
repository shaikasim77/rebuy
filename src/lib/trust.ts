import { supabase } from "@/integrations/supabase/client";

export const HANDOVER_REVIEW_TAGS = [
  "On-time pickup",
  "Item as described",
  "Kind & responsive",
  "Smooth handover",
] as const;

export type HandoverReviewTag = (typeof HANDOVER_REVIEW_TAGS)[number];

export interface HandoverReviewPayload {
  stars: number;
  tags: string[];
  note: string;
}

const REVIEW_PREFIX = "[REBUY_REVIEW]";

export function formatHandoverReviewMessage(review: HandoverReviewPayload): string {
  const stars = Math.min(5, Math.max(1, Math.round(review.stars)));
  const tags = review.tags.slice(0, 4).map((t) => t.trim()).filter(Boolean);
  const note = review.note.trim().slice(0, 400);
  return `${REVIEW_PREFIX}${JSON.stringify({ stars, tags, note })}`.slice(0, 1000);
}

export function parseHandoverReviewMessage(body: string): HandoverReviewPayload | null {
  if (!body || !body.startsWith(REVIEW_PREFIX)) return null;
  try {
    const parsed = JSON.parse(body.slice(REVIEW_PREFIX.length)) as Partial<HandoverReviewPayload>;
    const stars = typeof parsed.stars === "number" ? Math.min(5, Math.max(1, Math.round(parsed.stars))) : 5;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === "string").slice(0, 4)
      : [];
    const note = typeof parsed.note === "string" ? parsed.note : "";
    return { stars, tags, note };
  } catch {
    return null;
  }
}

export interface OwnerTrustInfo {
  id: string;
  displayName: string;
  givenCount: number;
}

export async function fetchOwnerTrust(ownerId: string): Promise<OwnerTrustInfo> {
  const [profileRes, givenRes] = await Promise.all([
    supabase.from("profiles").select("id,display_name").eq("id", ownerId).maybeSingle(),
    supabase.rpc("rebuy_given_count", { member_id: ownerId }),
  ]);
  return {
    id: ownerId,
    displayName: profileRes.data?.display_name || "Rebuy Member",
    givenCount: typeof givenRes.data === "number" ? givenRes.data : Number(givenRes.data ?? 0),
  };
}

export const REPORT_REASONS = [
  "Already given away / unavailable",
  "Spam or misleading post",
  "Inappropriate item",
  "Wrong category or location",
] as const;

export interface ItemReport {
  itemId: string;
  reason: string;
  details: string;
  hidden: boolean;
  reportedAt: string;
}

const REPORTS_STORAGE_PREFIX = "rebuy:reported-items:";

export function loadReportedItems(userId?: string | undefined): ItemReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${REPORTS_STORAGE_PREFIX}${userId ?? "anon"}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ItemReport[]) : [];
  } catch {
    return [];
  }
}

export function saveReportedItem(report: ItemReport, userId?: string | undefined): ItemReport[] {
  const current = loadReportedItems(userId).filter((r) => r.itemId !== report.itemId);
  const next = [report, ...current].slice(0, 100);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${REPORTS_STORAGE_PREFIX}${userId ?? "anon"}`, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}
