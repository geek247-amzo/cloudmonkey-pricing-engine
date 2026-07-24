import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowRight, Copy, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/auth/two-factor/setup")({
  head: () => ({
    meta: [{ title: "Set up two-factor authentication - CloudMonkey" }],
  }),
  component: TwoFactorSetupPage,
});

function TwoFactorSetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const secret = useMemo(() => {
    if (!totpURI) return "";
    try {
      return new URL(totpURI).searchParams.get("secret") ?? "";
    } catch {
      return "";
    }
  }, [totpURI]);

  useEffect(() => {
    let cancelled = false;
    if (!totpURI) {
      setQrCodeUrl("");
      return;
    }

    QRCode.toDataURL(totpURI, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 7,
      color: {
        dark: "#07102c",
        light: "#ffffff",
      },
    })
      .then((value) => {
        if (!cancelled) setQrCodeUrl(value);
      })
      .catch(() => {
        if (!cancelled) setQrCodeUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [totpURI]);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      toast.error("Enter your password to enable two-factor authentication");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await authClient.twoFactor.enable({
        password,
        issuer: "CloudMonkey",
      });
      if (error) {
        toast.error(error.message || "Unable to enable two-factor authentication");
        return;
      }
      setTotpURI(data?.totpURI ?? "");
      setBackupCodes(data?.backupCodes ?? []);
      toast.success("Authenticator secret generated");
    } catch {
      toast.error("Unable to start two-factor setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      toast.error("Enter the code from your authenticator app");
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
        trustDevice: true,
      });
      if (error) {
        toast.error(error.message || "Invalid authentication code");
        return;
      }
      toast.success("Two-factor authentication enabled");
      router.navigate({ to: "/dashboard" });
    } catch {
      toast.error("Unable to verify authenticator code");
    } finally {
      setIsLoading(false);
    }
  };

  const copyValue = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <AuthShell
      eyebrow="Required setup"
      title={<>Secure your CloudMonkey login.</>}
      subtitle="Email and password accounts must enable an authenticator app before using the dashboard."
    >
      {!totpURI ? (
        <form className="grid gap-4" onSubmit={handleStart}>
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
            <ShieldCheck className="mb-3 h-5 w-5 text-[var(--ai)]" />
            Google and Microsoft sign-ins are already protected by their identity providers. This setup is for password-based CloudMonkey access.
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Confirm password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your CloudMonkey password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]"
          >
            {isLoading ? "Preparing..." : "Start setup"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={handleVerify}>
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <div className="text-sm font-semibold text-foreground">Scan with authenticator app</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Add a new time-based account in your authenticator app by scanning this QR code.
            </p>
            <div className="mt-4 flex justify-center">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="CloudMonkey two-factor setup QR code"
                  className="h-56 w-56 rounded-lg border border-border bg-white p-3"
                />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-border bg-white p-3 text-center text-xs text-muted-foreground">
                  Preparing QR code...
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <div className="text-sm font-semibold text-foreground">Manual setup key</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              If scanning is unavailable, paste this key into your authenticator app.
            </p>
            <div className="mt-3 flex gap-2">
              <Input value={secret} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" className="rounded-lg" onClick={() => copyValue(secret, "Setup key")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full rounded-lg"
              onClick={() => copyValue(totpURI, "Authenticator URI")}
            >
              Copy full authenticator URI
            </Button>
          </div>

          {backupCodes.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
              <div className="text-sm font-semibold text-foreground">Backup codes</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {backupCodes.map((backupCode) => (
                  <code key={backupCode} className="rounded-lg bg-white px-3 py-2 text-xs text-foreground">
                    {backupCode}
                  </code>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full rounded-lg"
                onClick={() => copyValue(backupCodes.join("\n"), "Backup codes")}
              >
                Copy backup codes
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">Authenticator code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-2xl bg-[var(--ai)] shadow-[var(--shadow-elevated)]"
          >
            {isLoading ? "Verifying..." : "Enable two-factor authentication"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
