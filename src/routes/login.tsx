import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/GoogleButton";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login – Rebuy" },
      { name: "description", content: "Log in to Rebuy to post and share items." },
      { property: "og:title", content: "Login – Rebuy" },
      { property: "og:description", content: "Log in to Rebuy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => {
    const r = s["redirect"];
    return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? { redirect: r } : {};
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate({ to: redirect ?? "/browse", replace: true });
    }
  }, [user, navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      toast.error("Please enter both email and password");
      return;
    }
    setAuthError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setBusy(false);
    if (error) {
      const msg =
        error.message === "Email not confirmed"
          ? "Please confirm your email first — check your inbox for the link we sent."
          : error.message === "Invalid login credentials"
            ? "Invalid email or password. Check for typos, use a one-click email link below, or reset your password."
            : error.message;
      setAuthError(msg);
      toast.error(msg);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: redirect ?? "/browse" });
  };

  const sendMagicLink = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Enter your email address first");
      return;
    }
    setOtpBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: `${window.location.origin}${redirect ?? "/browse"}` },
    });
    setOtpBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOtpSent(true);
    toast.success("Magic login link sent! Check your email inbox.");
  };

  return (
    <main className="bg-background flex min-h-[65vh] items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-soft">
        <h1 className="font-display text-3xl font-bold">Login</h1>
        {redirect === "/post" && <p className="text-sm text-muted-foreground">Please log in to post an item.</p>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAuthError(null);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <div className="relative">
            <Input
              id="pw"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAuthError(null);
              }}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {authError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {authError}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Logging in..." : "Login"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={otpBusy}
          onClick={sendMagicLink}
        >
          <Mail className="h-4 w-4" />
          {otpBusy ? "Sending link..." : otpSent ? "Magic link sent — check email" : "Email me a login link"}
        </Button>
        <GoogleButton />
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-primary">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
