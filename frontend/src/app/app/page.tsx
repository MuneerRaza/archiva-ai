"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface MeResponse {
  id: string;
  email: string;
  role: string;
  workspace_id: string;
}

export default function AppEntryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap(): Promise<void> {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session) {
          router.replace("/login");
          return;
        }

        const me = await api.get<MeResponse>("/auth/me");
        if (!mounted) return;

        router.replace(`/app/${me.workspace_id}`);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load workspace");
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--overlay-8)] bg-[var(--overlay-3)] p-5">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              Retry
            </button>
            <Link
              href="/login"
              className="rounded-md border border-[var(--overlay-8)] px-3 py-2 text-xs font-medium"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  );
}
