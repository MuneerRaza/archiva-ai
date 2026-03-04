import { cn } from "@/lib/utils";

interface LoadingDotsProps {
  className?: string;
  color?: "dark" | "light" | "primary";
}

export function LoadingDots({ className, color = "dark" }: LoadingDotsProps) {
  const dotColor =
    color === "primary" ? "bg-primary-foreground" :
    color === "dark" ? "bg-foreground" : "bg-background";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn("h-1 w-1 rounded-full animate-bounce", dotColor)}
        style={{ animationDelay: "0ms", animationDuration: "600ms" }}
      />
      <span
        className={cn("h-1 w-1 rounded-full animate-bounce", dotColor)}
        style={{ animationDelay: "150ms", animationDuration: "600ms" }}
      />
      <span
        className={cn("h-1 w-1 rounded-full animate-bounce", dotColor)}
        style={{ animationDelay: "300ms", animationDuration: "600ms" }}
      />
    </span>
  );
}
