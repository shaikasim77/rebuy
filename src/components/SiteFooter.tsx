import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/reuse-world-logo.jpeg.asset.json";
import { Button } from "@/components/ui/button";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gold/35 px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/80 bg-primary ring-1 ring-gold/25 shadow-sm">
            <img
              src={`${logoAsset.url}?v=3`}
              alt="Rebuy emblem"
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="h-full w-full scale-[1.06] object-cover"
            />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">Rebuy - One person's spare, another's need.</p>
            <p className="mt-1 text-sm text-muted-foreground">Everything is free. Reuse instead of waste.</p>
          </div>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-1">
          <Button asChild variant="ghost" size="sm"><Link to="/">Home</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/browse">Browse</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/post">Post</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/wishlist">Wishlist</Link></Button>
        </nav>
      </div>
    </footer>
  );
}