import { supabase } from "@/integrations/supabase/client";
import { signItems } from "./available-items";

export type RequestRecord = Awaited<ReturnType<typeof fetchRequests>>[number];

export async function fetchRequests(userId: string) {
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const ids = [...new Set(data.flatMap((r) => (r.offer_item_id ? [r.item_id, r.offer_item_id] : [r.item_id])))];
  const users = [...new Set(data.flatMap((r) => [r.owner_id, r.requester_id]))];
  const [items, profiles] = await Promise.all([
    supabase.from("items").select("*,item_photos(storage_path,sort_order)").in("id", ids),
    supabase.from("profiles").select("id,display_name,points").in("id", users),
  ]);
  if (items.error) throw items.error;
  if (profiles.error) throw profiles.error;
  const signed = await signItems(items.data);
  return data.map((r) => ({
    ...r,
    item: signed.find((i) => i.id === r.item_id),
    offer: signed.find((i) => i.id === r.offer_item_id),
    owner: profiles.data.find((p) => p.id === r.owner_id),
    requester: profiles.data.find((p) => p.id === r.requester_id),
  }));
}

export async function fetchRequestedItemIds(userId: string): Promise<Set<string>> {
  const [modern, legacy] = await Promise.all([
    supabase.from("requests").select("item_id").eq("requester_id", userId),
    supabase.from("item_requests").select("item_id").eq("requester_id", userId),
  ]);
  const ids = new Set<string>();
  modern.data?.forEach((r) => ids.add(r.item_id));
  legacy.data?.forEach((r) => ids.add(r.item_id));
  return ids;
}

export async function updateRequestStatus(
  requestId: string,
  status: "accepted" | "declined" | "completed",
) {
  const { data, error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelPendingRequest(requestId: string) {
  const { error } = await supabase.from("requests").delete().eq("id", requestId);
  if (error) throw error;
}

export async function fetchRequestMessages(requestId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendRequestMessage(requestId: string, senderId: string, body: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ request_id: requestId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchLegacyRequestsForMyItems(userId: string) {
  const { data, error } = await supabase
    .from("item_requests")
    .select("id, requester_name, message, created_at, items!inner(id, name, category, user_id)")
    .eq("items.user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}