import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LocateFixed, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "@/hooks/use-location";
import { supabase } from "@/integrations/supabase/client";
import {
  itemCategories,
  itemConditions,
  itemFormSchema,
  listingSchema,
  validatePhotos,
} from "@/lib/item-form";

export interface EditableItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  condition: string;
  description: string;
  location: string;
  listing_type: "give" | "exchange";
  wants: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
}

export function EditItemDialog({
  item,
  hasRequests,
  open,
  onOpenChange,
}: {
  item: EditableItem | null;
  hasRequests: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { location: gpsCoords, locating, locate } = useLocation();
  const photoInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    category: "other",
    condition: "used",
    description: "",
    location: "",
    listing_type: "give" as "give" | "exchange",
    wants: "",
  });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [attachGps, setAttachGps] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item && open) {
      setForm({
        name: item.name,
        category: item.category,
        condition: item.condition,
        description: item.description ?? "",
        location: item.location,
        listing_type: item.listing_type,
        wants: item.wants ?? "",
      });
      setNewFiles([]);
      setAttachGps(false);
    }
  }, [item, open]);

  useEffect(() => {
    if (!newFiles.length) {
      setPreviews([]);
      return;
    }
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newFiles]);

  if (!item) return null;

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected?.length) return;
    const combined = [...newFiles, ...Array.from(selected)].slice(0, 5);
    const err = validatePhotos(combined);
    if (err) {
      toast.error(err);
      return;
    }
    setNewFiles(combined);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const parsed = itemFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your item details");
      return;
    }
    const listingParsed = listingSchema.safeParse({
      listing_type: hasRequests ? item.listing_type : form.listing_type,
      wants: form.wants,
    });
    if (!listingParsed.success) {
      toast.error(listingParsed.error.issues[0]?.message ?? "Invalid listing options");
      return;
    }

    setBusy(true);
    try {
      let nextPhotoUrl = item.photo_url;
      if (newFiles.length > 0) {
        const err = validatePhotos(newFiles);
        if (err) {
          toast.error(err);
          setBusy(false);
          return;
        }
        const uploadedPaths: string[] = [];
        for (const file of newFiles) {
          const path = `${item.user_id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
          const up = await supabase.storage.from("item-photos").upload(path, file);
          if (up.error) {
            toast.error(up.error.message);
            setBusy(false);
            return;
          }
          uploadedPaths.push(path);
        }
        nextPhotoUrl = uploadedPaths[0] ?? nextPhotoUrl;
        await supabase.from("item_photos").delete().eq("item_id", item.id);
        await supabase.from("item_photos").insert(
          uploadedPaths.map((storage_path, sort_order) => ({
            item_id: item.id,
            storage_path,
            sort_order,
          })),
        );
      }

      const updatePayload = {
        ...parsed.data,
        listing_type: listingParsed.data.listing_type,
        wants:
          listingParsed.data.listing_type === "exchange"
            ? listingParsed.data.wants || null
            : null,
        photo_url: nextPhotoUrl,
        ...(attachGps && gpsCoords
          ? { latitude: gpsCoords.latitude, longitude: gpsCoords.longitude }
          : {}),
      };

      const { error } = await supabase.from("items").update(updatePayload).eq("id", item.id);
      if (error) {
        toast.error(error.message);
        return;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-items", item.user_id] }),
        qc.invalidateQueries({ queryKey: ["items"] }),
      ]);
      toast.success("Item updated!");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't update this item. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit Item</DialogTitle>
          <DialogDescription>
            Update your item details, location, or replace its photos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Item name</Label>
            <Input
              id="edit-name"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(category) => setForm({ ...form, category })}
              >
                <SelectTrigger id="edit-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itemCategories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-condition">Condition</Label>
              <Select
                value={form.condition}
                onValueChange={(condition) => setForm({ ...form, condition })}
              >
                <SelectTrigger id="edit-condition" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itemConditions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Sharing type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                disabled={hasRequests}
                variant={form.listing_type === "give" ? "default" : "outline"}
                onClick={() => setForm({ ...form, listing_type: "give" })}
              >
                Give for Free
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={hasRequests}
                variant={form.listing_type === "exchange" ? "default" : "outline"}
                onClick={() => setForm({ ...form, listing_type: "exchange" })}
              >
                Exchange
              </Button>
            </div>
            {hasRequests && (
              <p className="text-[11px] text-muted-foreground">
                Sharing type is locked because this item already has requests.
              </p>
            )}
          </div>

          {form.listing_type === "exchange" && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-wants">Preferred exchange item (optional)</Label>
              <Input
                id="edit-wants"
                maxLength={200}
                value={form.wants}
                onChange={(e) => setForm({ ...form, wants: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="edit-loc">Location</Label>
              <Button
                type="button"
                variant={attachGps && gpsCoords ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={locating}
                onClick={() => {
                  setAttachGps(true);
                  locate();
                }}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                {locating
                  ? "Locating..."
                  : attachGps && gpsCoords
                    ? "New GPS ready"
                    : "Update GPS pin"}
              </Button>
            </div>
            <Input
              id="edit-loc"
              maxLength={100}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Replace photos (optional)</Label>
            <Input
              ref={photoInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => photoInput.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {newFiles.length ? `${newFiles.length} new photos selected` : "Choose new photos"}
            </Button>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {previews.map((src, idx) => (
                  <div key={src} className="relative overflow-hidden rounded-lg border border-border">
                    <img src={src} alt={`New preview ${idx + 1}`} className="h-20 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
