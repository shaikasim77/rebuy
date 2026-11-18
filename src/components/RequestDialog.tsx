import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRequestMessage, requestFormSchema, requestMessageSchema } from "@/lib/item-form";

export type RequestDialogItem = {
  id: string;
  user_id: string;
  name: string;
  listing_type?: "give" | "exchange";
  wants?: string | null;
};

export function RequestDialog({
  item,
  open,
  onOpenChange,
  onSuccess,
}: {
  item: RequestDialogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [offer, setOffer] = useState("");
  const [busy, setBusy] = useState(false);

  const exchange = item.listing_type === "exchange";

  useEffect(() => {
    if (!open || !user) return;
    const defaultName =
      (user.user_metadata?.["full_name"] as string | undefined) ||
      (user.user_metadata?.["name"] as string | undefined) ||
      "";
    setName((prev) => prev || defaultName);
    setEmail((prev) => prev || user.email || "");
  }, [open, user]);

  const { data: ownItems = [], isPending, error } = useQuery({
    queryKey: ["offer-items", user?.id, item.id],
    enabled: open && !!user && exchange,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("items")
        .select("id,name")
        .eq("user_id", user.id)
        .eq("is_available", true)
        .neq("id", item.id);
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy) return;

    const contactParsed = requestFormSchema.safeParse({ name, email });
    if (!contactParsed.success) {
      toast.error(contactParsed.error.issues[0]?.message ?? "Please check your name and email");
      return;
    }

    const msgParsed = requestMessageSchema.safeParse(message);
    if (!msgParsed.success) {
      toast.error(msgParsed.error.issues[0]?.message ?? "Message is too long");
      return;
    }

    if (exchange && !offer) {
      toast.error("Choose an item of yours to offer in exchange");
      return;
    }

    const packedMessage = formatRequestMessage(contactParsed.data.email, msgParsed.data);

    setBusy(true);
    try {
      const { error } = await supabase.from("requests").insert({
        item_id: item.id,
        owner_id: item.user_id,
        requester_id: user.id,
        message: packedMessage,
        offer_item_id: exchange ? offer : null,
        requester_name: contactParsed.data.name,
        requester_phone: "",
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("You have already requested this item.");
        }
        throw error;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["requests"] }),
        qc.invalidateQueries({ queryKey: ["requested-items", user.id] }),
        qc.invalidateQueries({ queryKey: ["item-requests", user.id] }),
      ]);
      toast.success("Request sent! The donor has been notified.");
      setMessage("");
      setOffer("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't send your request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{exchange ? "Offer an exchange" : "Request this item"}</DialogTitle>
          <DialogDescription>
            {item.name}
            {exchange && item.wants ? ` · Wants: ${item.wants}` : ""} — The donor will receive your name and email notification to arrange pickup.
          </DialogDescription>
        </DialogHeader>
        {!user ? (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Please log in so the donor can receive your request and email.</p>
            <Button asChild className="w-full">
              <Link to="/login">Login to request</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {exchange &&
              (isPending ? (
                <p className="text-sm text-muted-foreground">Finding your items…</p>
              ) : error ? (
                <p className="text-sm text-destructive">Couldn't load your items.</p>
              ) : ownItems.length ? (
                <div className="space-y-2">
                  <Label>Your offered item</Label>
                  <Select value={offer} onValueChange={setOffer}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose your item" />
                    </SelectTrigger>
                    <SelectContent>
                      {ownItems.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You need at least one available item of your own to offer.{" "}
                  <Link className="font-medium text-primary underline" to="/post">
                    Post one first.
                  </Link>
                </p>
              ))}
            <div className="space-y-2">
              <Label htmlFor="rq-name">Your name</Label>
              <Input
                id="rq-name"
                required
                maxLength={80}
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-email" className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                Your email (shared with donor)
              </Label>
              <Input
                id="rq-email"
                type="email"
                required
                maxLength={255}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rq-message">Message to donor (optional)</Label>
              <Textarea
                id="rq-message"
                maxLength={350}
                rows={3}
                placeholder="Share when you can pick it up..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || (exchange && (!offer || !!error))}
            >
              {busy ? "Sending..." : "Send Request & Notify Donor"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}