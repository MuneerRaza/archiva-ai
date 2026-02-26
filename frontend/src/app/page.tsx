import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <h1 className="text-4xl font-bold tracking-tight">Archiva.ai</h1>
      <p className="max-w-md text-center text-lg text-muted-foreground">
        An AI agent that lives inside your organization&apos;s data — not a search
        tool, a reasoning system.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Get Started
        </Link>
        <Link
          href="/app/demo"
          className="rounded-md border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          Demo
        </Link>
      </div>
    </div>
  );
}
