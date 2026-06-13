import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProviderButtonsProps = {
  className?: string;
  label?: string;
};

export function ProviderButtons({ className, label = "Continue with" }: ProviderButtonsProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <Button variant="outline" className="h-11 justify-start rounded-2xl border-border/70 bg-background px-4 shadow-sm">
        <GoogleIcon />
        {label} Google
      </Button>
      <Button variant="outline" className="h-11 justify-start rounded-2xl border-border/70 bg-background px-4 shadow-sm">
        <MicrosoftIcon />
        {label} Office 365
      </Button>
    </div>
  );
}

export function SectionDivider({ text = "Or use email" }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      <span>{text}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        d="M22 12.227c0-.638-.056-1.251-.16-1.84H12v3.484h5.602a4.797 4.797 0 0 1-2.082 3.15v2.62h3.367C20.984 17.808 22 15.2 22 12.227Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.464-.985 7.285-2.67l-3.368-2.62c-.935.625-2.13 1.006-3.917 1.006-3.008 0-5.56-2.03-6.47-4.764H1.998v2.714A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.53 13.952A6.61 6.61 0 0 1 5.18 12c0-.678.118-1.337.35-1.952V7.334H1.998A11 11 0 0 0 1 12c0 1.772.42 3.448 1.166 4.666l3.364-2.714Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.33c1.62 0 3.073.56 4.22 1.66l3.166-3.166C17.45 2.08 14.97 1 12 1A11 11 0 0 0 1.998 7.334l3.532 2.714C6.44 7.36 8.992 5.33 12 5.33Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
