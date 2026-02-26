import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface MeResponse {
  id: string;
  email: string;
  role: string;
  workspace_id: string;
}

export default async function AppEntryPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Call backend to provision user and get workspace ID
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    // If backend fails, still redirect to login
    redirect("/login");
  }

  const me: MeResponse = await res.json();
  redirect(`/app/${me.workspace_id}`);
}
