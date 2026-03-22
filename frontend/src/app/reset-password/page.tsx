"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoIcon } from "@/components/logo";
import { LoadingDots } from "@/components/ui/loading-dots";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Supabase handles the token exchange automatically when the user
  // clicks the email link — it sets the session via the URL hash fragment.
  // We just need to wait for the auth state to be ready.
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Also check if already authenticated (user may have refreshed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        // Give Supabase a moment to process the hash fragment
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: retryData }) => {
            if (retryData.session) {
              setSessionReady(true);
            } else {
              setSessionError(true);
            }
          });
        }, 1500);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/app");
    }, 2000);
  }

  if (sessionError) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
        <div className="relative z-10 w-full max-w-[400px] text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <LogoIcon className="h-11 w-11" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Invalid or expired link
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            This password reset link is no longer valid. Please request a new one.
          </p>
          <p className="mt-6">
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1.5 text-[13px] text-primary font-medium transition-colors hover:text-primary/80"
            >
              Request new reset link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <LogoIcon className="h-11 w-11" />
          </div>

          {success ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Password updated
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Redirecting you to the app...
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Set new password
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Choose a new password for your account.
              </p>
            </>
          )}
        </div>

        {!success && (
          <>
            {!sessionReady ? (
              <div className="flex items-center justify-center py-8">
                <LoadingDots color="light" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-[13px] font-medium text-muted-foreground"
                  >
                    New password
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
                      autoComplete="new-password"
                      autoFocus
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

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="text-[13px] font-medium text-muted-foreground"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="flex h-11 w-full rounded-[10px] border border-[var(--overlay-8)] bg-[var(--overlay-3)] px-3.5 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-primary/40 focus:bg-[var(--overlay-6)] focus:ring-1 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

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
                  {loading ? <LoadingDots color="primary" /> : "Update password"}
                </button>
              </form>
            )}
          </>
        )}

        {!success && (
          <p className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
