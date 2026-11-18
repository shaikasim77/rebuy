import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/GoogleButton";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up – Rebuy" },
      { name: "description", content: "Create a free Rebuy account." },
      { property: "og:title", content: "Sign up – Rebuy" },
      { property: "og:description", content: "Create a free Rebuy account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) {
      navigate({ to: "/browse", replace: true });
    }
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/browse`,
        data: { full_name: name.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created! Welcome to Rebuy.");
      navigate({ to: "/browse" });
      return;
    }
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      toast.error("An account with this email already exists. Please log in or reset your password.");
      navigate({ to: "/login" });
      return;
    }
    setSent(true);
  };

  return (
    <main className="bg-background flex min-h-[65vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-soft">
        {sent ? (
          <div className="space-y-3 text-center">
            <h1 className="font-display text-3xl font-bold">Check your email</h1>
            <p className="text-muted-foreground">
              We sent a confirmation link to {email}. Click it to finish signing up.
            </p>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link to="/login">Go to Login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="font-display text-3xl font-bold">Sign up</h1>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password (min 6 characters)</Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating..." : "Create account"}
            </Button>
            <GoogleButton />
            <p className="text-center text-sm text-muted-foreground">
              Have an account?{" "}
              <Link to="/login" className="font-semibold text-primary">
                Login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
