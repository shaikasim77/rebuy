import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LocateFixed, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  itemCategories,
  itemConditions,
  itemFormSchema,
  listingSchema,
  validatePhotos,
} from "@/lib/item-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/hooks/use-location";
import { itemRewardPoints } from "@/lib/rebuy";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Post an Item – Rebuy" },
      { name: "description", content: "Post an item you no longer need on Rebuy." },
      { property: "og:title", content: "Post an Item – Rebuy" },
      { property: "og:description", content: "Share an item with your community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostItem,
});

function PostItem() {
  const { user, loading } = useAuth();
  const { location: coords, locating, locate } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const photoInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    category: "",
    condition: "",
    listing_type: "give" as "give" | "exchange",
    wants: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!files.length) {
      setPreviews([]);
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/post" }, replace: true });
  }, [loading, user, navigate]);

  if (loading) return <main className="p-10 text-center text-muted-foreground">Loading...</main>;
  if (!user) return <main className="p-10 text-center text-muted-foreground">Taking you to login...</main>;

  const handleFilesSelected = (selected: FileList | null) => {
    if (!selected?.length) return;
    const combined = [...files, ...Array.from(selected)].slice(0, 5);
    const err = validatePhotos(combined);
    if (err) {
      toast.error(err);
      return;
    }
    setFiles(combined);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const parsed = itemFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    const listingParsed = listingSchema.safeParse({
      listing_type: form.listing_type,
      wants: form.wants,
    });
    if (!listingParsed.success) {
      toast.error(listingParsed.error.issues[0]?.message ?? "Invalid listing options");
      return;
    }
    const photoError = validatePhotos(files);
    if (photoError) {
      toast.error(photoError);
      return;
    }

    setBusy(true);
    try {
      const uploadedPaths: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const up = await supabase.storage.from("item-photos").upload(path, file);
        if (up.error) {
          toast.error(up.error.message);
          return;
        }
        uploadedPaths.push(path);
      }

      const { data: inserted, error } = await supabase
        .from("items")
        .insert({
          ...parsed.data,
          user_id: user.id,
          photo_url: uploadedPaths[0] ?? null,
          listing_type: listingParsed.data.listing_type,
          wants:
            listingParsed.data.listing_type === "exchange"
              ? listingParsed.data.wants || null
              : null,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        })
        .select("id")
        .single();

      if (error || !inserted) {
        toast.error(error?.message ?? "Couldn't save your item.");
        return;
      }

      if (uploadedPaths.length > 0) {
        const photoRows = uploadedPaths.map((storage_path, sort_order) => ({
          item_id: inserted.id,
          storage_path,
          sort_order,
        }));
        const { error: photoErr } = await supabase.from("item_photos").insert(photoRows);
        if (photoErr) {
          console.warn("Could not save item_photos rows:", photoErr.message);
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["my-items", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["community"] }),
      ]);
      const rewards = itemRewardPoints({
        category: parsed.data.category,
        condition: parsed.data.condition,
        listing_type: listingParsed.data.listing_type,
      });
      toast.success(
        `Your item is now live! Earn +${rewards.donor} donor pts (receiver earns +${rewards.receiver} pts) on handover.`,
      );
      navigate({ to: "/browse" });
    } catch {
      toast.error("Couldn't post your item. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const previewRewards = itemRewardPoints({
    category: form.category || "other",
    condition: form.condition || "used",
    listing_type: form.listing_type,
  });

  return (
    <main className="bg-background min-h-[65vh] px-4 py-12">
      <form
        onSubmit={submit}
        className="mx-auto max-w-lg space-y-5 rounded-2xl border border-border bg-card p-8 shadow-soft"
      >
        <div>
          <h1 className="font-display text-3xl font-bold">Post an Item</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Rewards for this item: <strong>+{previewRewards.donor} pts</strong> for you (donor) ·{" "}
            <strong>+{previewRewards.receiver} pts</strong> for the receiver on handover.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Item name</Label>
          <Input
            id="name"
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {itemCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition">Item condition</Label>
            <Select
              value={form.condition}
              onValueChange={(condition) => setForm({ ...form, condition })}
            >
              <SelectTrigger id="condition" className="w-full">
                <SelectValue placeholder="Choose a condition" />
              </SelectTrigger>
              <SelectContent>
                {itemConditions.map((condition) => (
                  <SelectItem key={condition.value} value={condition.value}>
                    {condition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sharing type</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.listing_type === "give" ? "default" : "outline"}
              onClick={() => setForm({ ...form, listing_type: "give" })}
            >
              Give for Free
            </Button>
            <Button
              type="button"
              variant={form.listing_type === "exchange" ? "default" : "outline"}
              onClick={() => setForm({ ...form, listing_type: "exchange" })}
            >
              Exchange
            </Button>
          </div>
        </div>

        {form.listing_type === "exchange" && (
          <div className="space-y-2">
            <Label htmlFor="wants">What would you like in exchange? (optional)</Label>
            <Input
              id="wants"
              maxLength={200}
              placeholder="e.g. Study lamp, story books, or indoor plants"
              value={form.wants}
              onChange={(e) => setForm({ ...form, wants: e.target.value })}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            maxLength={1000}
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="loc">Location (city / neighborhood)</Label>
            <Button
              type="button"
              variant={coords ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={locating}
              onClick={locate}
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? "Locating..." : coords ? "GPS attached" : "Attach GPS"}
            </Button>
          </div>
          <Input
            id="loc"
            maxLength={100}
            placeholder="e.g. Hyderabad, Madhapur"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="photo">Photos (1 to 5 images)</Label>
          <Input
            ref={photoInput}
            id="photo"
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => photoInput.current?.click()}
            disabled={files.length >= 5}
          >
            <Upload />
            {files.length
              ? `Add more photos (${files.length}/5 selected)`
              : "Upload photos (up to 5)"}
          </Button>
        </div>

        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative overflow-hidden rounded-lg border border-border">
                <img src={src} alt={`Preview ${i + 1}`} className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={busy}>
          {busy ? "Posting..." : "Post Item"}
        </Button>
      </form>
    </main>
  );
}
