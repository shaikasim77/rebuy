export function itemShareUrl(itemId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://rebuy.app";
  return `${origin}/browse?item=${encodeURIComponent(itemId)}`;
}

export function itemWhatsAppShareUrl(item: {
  id: string;
  name: string;
  location: string;
  listing_type: string;
}): string {
  const url = itemShareUrl(item.id);
  const tag = item.listing_type === "exchange" ? "Open to Exchange" : "Free on Rebuy";
  const text = `${item.name} (${tag}) in ${item.location} — View & request on Rebuy: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
