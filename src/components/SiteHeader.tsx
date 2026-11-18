import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Bell, CheckCheck, Heart, Mail } from "lucide-react";
import logoAsset from "@/assets/reuse-world-logo.jpeg.asset.json";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist } from "@/hooks/use-wishlist";
import { useNotifications } from "@/hooks/use-notifications";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyPointsSummary } from "@/lib/community";
import { donorLevel } from "@/lib/rebuy";

export function SiteHeader() {
  const { user } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tab = (path: string) => (pathname === path ? "secondary" : "ghost") as "secondary" | "ghost";

  const { data: pointsSummary } = useQuery({
    queryKey: ["my-points-summary", user?.id],
    queryFn: () => fetchMyPointsSummary(user!.id),
    enabled: !!user,
  });

  const points = pointsSummary?.totalPoints ?? 0;
  const level = donorLevel(points);

  return (
    <header className="sticky top-0 z-20 border-b border-gold/35 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-3">
        <Link
          to="/"
          aria-label="Rebuy home"
          className="group flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/80 bg-primary ring-2 ring-gold/20 shadow-soft transition-transform duration-200 group-hover:scale-[1.03]">
            <img
              src={`${logoAsset.url}?v=3`}
              alt="Rebuy emblem"
              width={44}
              height={44}
              referrerPolicy="no-referrer"
              className="h-full w-full scale-[1.06] object-cover"
            />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Rebuy
            </span>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm sm:gap-2">
          <Button asChild variant={tab("/")} size="sm">
            <Link to="/">Home</Link>
          </Button>
          <Button asChild variant={tab("/browse")} size="sm">
            <Link to="/browse">Browse</Link>
          </Button>
          <Button asChild variant={tab("/post")} size="sm">
            <Link to="/post">Post</Link>
          </Button>
          <Button asChild variant={tab("/wishlist")} size="sm">
            <Link to="/wishlist" className="relative">
              <Heart className="h-4 w-4" />
              <span>Wishlist</span>
              {wishlistCount > 0 && (
                <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-gold-foreground">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant={tab("/my-posts")} size="sm">
                <Link to="/my-posts">My Posts</Link>
              </Button>
              <Button asChild variant={tab("/my-requests")} size="sm">
                <Link to="/my-requests">My Requests</Link>
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Notifications"
                    className="relative"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-gold-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                      <p className="font-display text-sm font-semibold">Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                      </p>
                    </div>
                    {notifications.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={markAllAsRead}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No request notifications yet.
                      </p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markAsRead(n.id);
                            if (n.kind === "watch_match" && n.itemId) {
                              navigate({
                                to: "/browse",
                                search: { q: "", cat: "all", item: n.itemId },
                              });
                            } else {
                              navigate({ to: "/my-requests" });
                            }
                          }}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-accent ${
                            n.unread ? "bg-accent/50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground">{n.title}</p>
                            {n.unread && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                          {n.requesterEmail && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary">
                              <Mail className="h-3 w-3" />
                              {n.requesterEmail}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-border p-2">
                    <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                      <Link to="/my-requests">Open all requests</Link>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Link
                to="/my-posts"
                title={`Your personal points (${level.name})`}
                className="inline-flex items-center gap-1 rounded-md border border-gold/50 bg-accent px-2.5 py-1 text-xs font-semibold text-primary hover:bg-accent/80"
              >
                <Award className="h-3.5 w-3.5 text-gold-deep" />
                <span>{points} pts</span>
              </Link>

              <span className="max-w-[9rem] truncate px-1 font-medium text-foreground">
                Hi,{" "}
                {(user.user_metadata?.["full_name"] as string) ||
                  (user.user_metadata?.["name"] as string) ||
                  user.email?.split("@")[0]}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
