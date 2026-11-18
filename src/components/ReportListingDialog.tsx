import { useState } from "react";
import { Flag } from "lucide-react";
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
import { REPORT_REASONS, saveReportedItem, type ItemReport } from "@/lib/trust";

export function ReportListingDialog({
  item,
  userId,
  open,
  onOpenChange,
  onReported,
}: {
  item: { id: string; name: string } | null;
  userId?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported: (reports: ItemReport[]) => void;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [hideFromFeed, setHideFromFeed] = useState(true);

  if (!item) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveReportedItem(
      {
        itemId: item.id,
        reason,
        details: details.trim(),
        hidden: hideFromFeed,
        reportedAt: new Date().toISOString(),
      },
      userId,
    );
    onReported(updated);
    toast.success(
      hideFromFeed
        ? "Listing flagged and hidden from your feed."
        : "Listing flagged for community review.",
    );
    setDetails("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Flag className="h-5 w-5 text-destructive" />
            Report "{item.name}"
          </DialogTitle>
          <DialogDescription>
            Help keep Rebuy safe and trustworthy for your community.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label>Reason</Label>
            <div className="grid gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    reason === r
                      ? "border-primary bg-accent text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-details">Additional details (optional)</Label>
            <Textarea
              id="report-details"
              rows={2}
              maxLength={300}
              placeholder="Share what looks wrong..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hideFromFeed}
              onChange={(e) => setHideFromFeed(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Hide this listing from my Browse feed
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Submit Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
