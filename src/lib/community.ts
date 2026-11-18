import { supabase } from "@/integrations/supabase/client";
import { itemRewardPoints } from "./rebuy";

export async function fetchCommunity() {
  const totals = await supabase.rpc("rebuy_community_totals");
  if (totals.error) throw totals.error;
  return totals.data as { items: number; handovers: number; donors: number };
}

export async function fetchMyProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,points,avatar_url,created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type PersonalPointEntry = {
  id: string;
  itemName: string;
  category: string;
  condition: string;
  role: "donor" | "receiver";
  points: number;
  createdAt: string;
};

export type PersonalPointsSummary = {
  totalPoints: number;
  donorPoints: number;
  receiverPoints: number;
  givenCount: number;
  receivedCount: number;
  entries: PersonalPointEntry[];
};

export async function fetchMyPointsSummary(userId: string): Promise<PersonalPointsSummary> {
  const { data: completed, error } = await supabase
    .from("requests")
    .select("id,item_id,owner_id,requester_id,updated_at,created_at")
    .eq("status", "completed")
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  if (!completed.length) {
    return {
      totalPoints: 0,
      donorPoints: 0,
      receiverPoints: 0,
      givenCount: 0,
      receivedCount: 0,
      entries: [],
    };
  }

  const itemIds = [...new Set(completed.map((r) => r.item_id))];
  const { data: items, error: itemsErr } = await supabase
    .from("items")
    .select("id,name,category,condition,listing_type")
    .in("id", itemIds);

  if (itemsErr) throw itemsErr;

  let donorPoints = 0;
  let receiverPoints = 0;
  let givenCount = 0;
  let receivedCount = 0;

  const entries: PersonalPointEntry[] = completed.map((req) => {
    const item = items.find((i) => i.id === req.item_id);
    const rewards = itemRewardPoints(item);
    const isDonor = req.owner_id === userId;
    const pts = isDonor ? rewards.donor : rewards.receiver;

    if (isDonor) {
      donorPoints += pts;
      givenCount += 1;
    } else {
      receiverPoints += pts;
      receivedCount += 1;
    }

    return {
      id: req.id,
      itemName: item?.name ?? "Reused item",
      category: item?.category ?? "other",
      condition: item?.condition ?? "used",
      role: isDonor ? "donor" : "receiver",
      points: pts,
      createdAt: req.updated_at || req.created_at,
    };
  });

  return {
    totalPoints: donorPoints + receiverPoints,
    donorPoints,
    receiverPoints,
    givenCount,
    receivedCount,
    entries,
  };
}

export async function fetchMyGivenCount(userId: string) {
  const { data, error } = await supabase.rpc("rebuy_given_count", { member_id: userId });
  if (error) throw error;
  return data ?? 0;
}