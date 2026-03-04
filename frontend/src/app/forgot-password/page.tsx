"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoIcon } from "@/components/logo";
import { LoadingDots } from "@/components/ui/loading-dots";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
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

          {sent ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Check your email
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                We sent a password reset link to <span className="text-foreground">{email}</span>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Reset your password
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
            </>
          )}
        </div>

        {!sent && (
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
                autoFocus
                className="flex h-11 w-full rounded-[10px] border border-[var(--overlay-8)] bg-[var(--overlay-3)] px-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-primary/40 focus:bg-[var(--overlay-6)] focus:ring-1 focus:ring-primary/20"
              />
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
              {loading ? <LoadingDots color="primary" /> : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
