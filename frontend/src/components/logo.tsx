import { cn } from "@/lib/utils";

interface LogoIconProps {
  className?: string;
}

export function LogoIcon({ className }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("h-8 w-8", className)}
    >
      <rect x="6" y="8" width="14" height="14" rx="3" fill="#f97316" fillOpacity="0.6" transform="rotate(-15 13 15)" />
      <rect x="9" y="6" width="14" height="14" rx="3" fill="#a855f7" fillOpacity="0.5" transform="rotate(6 16 13)" />
      <rect x="12" y="10" width="14" height="14" rx="3" fill="#3b82f6" fillOpacity="0.6" transform="rotate(22 19 17)" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoIcon />
      {showText && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Archiva
        </span>
      )}
    </div>
  );
}
