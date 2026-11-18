import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendRequestMessage } from "@/lib/requests";
import { formatHandoverReviewMessage, HANDOVER_REVIEW_TAGS } from "@/lib/trust";

export function HandoverReviewDialog({
  requestId,
  userId,
  itemName,
  partnerName,
  open,
  onOpenChange,
}: {
  requestId: string;
  userId: string;
  itemName: string;
  partnerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(["Smooth handover"]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 4),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const formatted = formatHandoverReviewMessage({
        stars,
        tags: selectedTags,
        note,
      });
      await sendRequestMessage(requestId, userId, formatted);
      await qc.invalidateQueries({ queryKey: ["request-messages", requestId] });
      toast.success("Thank-you review shared!");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Rate & Thank {partnerName}</DialogTitle>
          <DialogDescription>
            Share quick feedback for the handover of <strong>{itemName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Rating</Label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStars(value)}
                  aria-label={`${value} stars`}
                  className="rounded-md p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 ${
                      value <= stars ? "fill-gold text-gold-deep" : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-semibold text-primary">{stars} / 5</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Quick highlights</Label>
            <div className="flex flex-wrap gap-2">
              {HANDOVER_REVIEW_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={active ? "secondary" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-note">Thank-you note (optional)</Label>
            <Textarea
              id="review-note"
              rows={3}
              maxLength={400}
              placeholder="e.g. Thank you so much for the smooth pickup!"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
