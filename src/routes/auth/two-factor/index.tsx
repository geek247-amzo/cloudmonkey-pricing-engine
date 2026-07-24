import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/two-factor/")({
  head: () => ({
    meta: [{ title: "Two-factor authentication - CloudMonkey" }],
  }),
  component: TwoFactorPage,
});

function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = useBackupCode ? backupCode.trim() : code.trim();
    if (!value) {
      toast.error("Enter your authentication code");
      return;
    }

    try {
      setIsLoading(true);
      const { error } = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({
            code: value,
            trustDevice,
          })
        : await authClient.twoFactor.verifyTotp({
            code: value,
            trustDevice,
          });

      if (error) {
        toast.error(error.message || "Invalid authentication code");
        return;
      }

      toast.success("Two-factor verified");
      router.navigate({ to: "/dashboard" });
    } catch {
      toast.error("Unable to verify two-factor code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Security check"
      title={<>Enter your two-factor code.</>}
      subtitle="Email and password accounts require a second factor before dashboard access."
      footer={
        <>
          Need another account? <Link to="/auth/sign-in" className="font-medium text-foreground hover:underline">Return to sign in</Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleVerify}>
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mb-3 h-5 w-5 text-[var(--ai)]" />
          Use the six-digit code from your authenticator app, or switch to a saved backup code.
        </div>

        {!useBackupCode ? (
          <div className="space-y-2">
            <Label htmlFor="totpCode">Authenticator code</Label>
            <Input
              id="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isLoading}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="backupCode">Backup code</Label>
            <Input
              id="backupCode"
              autoComplete="one-time-code"
              placeholder="Enter backup code"
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-[var(--ai)] focus:ring-[var(--ai)]"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          Trust this device for 30 days
        </label>

        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={() => setUseBackupCode((value) => !value)}
          disabled={isLoading}
        >
          {useBackupCode ? "Use authenticator code" : "Use backup code"}
        </Button>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]"
        >
          {isLoading ? "Verifying..." : "Verify and continue"}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </AuthShell>
  );
}
