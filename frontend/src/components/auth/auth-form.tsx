"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoIcon } from "@/components/logo";
import { LoadingDots } from "@/components/ui/loading-dots";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const isLogin = mode === "login";

  async function handleGoogle() {
    setOauthLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (isLogin) {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      router.push("/app");
      router.refresh();
    } else {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      // If email confirmation is enabled, session will be null
      if (!data.session) {
        setConfirmationSent(true);
        setLoading(false);
        return;
      }
      router.push("/app");
      router.refresh();
    }
  }

  if (confirmationSent) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/[0.04] blur-3xl" />
        </div>
        <div className="relative z-10 w-full max-w-[400px] text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <LogoIcon className="h-11 w-11" />
          </div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Click the link in the email to activate your account.
          </p>
          <p className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <LogoIcon className="h-11 w-11" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {isLogin ? "Sign in to Archiva" : "Create your Archiva account"}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {isLogin
              ? "Welcome back. Pick up where you left off."
              : "Start organizing your knowledge with AI."}
          </p>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium text-muted-foreground"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="flex h-11 w-full rounded-[10px] border border-[var(--overlay-8)] bg-[var(--overlay-3)] px-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-primary/40 focus:bg-[var(--overlay-6)] focus:ring-1 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium text-muted-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="flex h-11 w-full rounded-[10px] border border-[var(--overlay-8)] bg-[var(--overlay-3)] px-3.5 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-primary/40 focus:bg-[var(--overlay-6)] focus:ring-1 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isLogin && (
            <div className="flex justify-end -mt-1">
              <Link
                href="/forgot-password"
                className="text-[12px] text-muted-foreground/60 transition-colors hover:text-primary"
              >
                Forgot password?
              </Link>
            </div>
          )}

          {error && (
            <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5">
              <p className="text-[13px] text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <LoadingDots color="primary" />
            ) : (
              <>
                {isLogin ? "Sign in" : "Create account"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--overlay-6)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-[11px] uppercase tracking-widest text-muted-foreground/60">
              or
            </span>
          </div>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={oauthLoading}
          className="group flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-[var(--overlay-8)] bg-[var(--overlay-3)] text-[13px] font-medium text-foreground transition-all hover:border-[var(--overlay-15)] hover:bg-[var(--overlay-6)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          {oauthLoading ? (
            <LoadingDots color="light" />
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {/* Footer */}
        <p className="mt-8 text-center text-[13px] text-muted-foreground/70">
          {isLogin ? (
            <>
              New to Archiva?{" "}
              <Link
                href="/signup"
                className="text-primary font-medium transition-colors hover:text-primary/80"
              >
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary font-medium transition-colors hover:text-primary/80"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
