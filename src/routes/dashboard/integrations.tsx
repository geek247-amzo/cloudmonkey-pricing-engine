import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/integrations")({
  head: () => ({
    meta: [{ title: "Automation - CloudMonkey Dashboard" }],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automation"
        title={<>Workflow automation.</>}
        subtitle="Open the connected n8n workspace used for outbound email and operational workflows."
        actions={
          <Button asChild className="rounded-lg bg-[var(--ai)]">
            <a href="/n8n/" target="_blank" rel="noreferrer">
              Open n8n
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        }
      />

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <PlugZap className="h-5 w-5 text-[var(--ai)]" />
            n8n workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>The production compose stack exposes n8n at `/n8n/` and the app calls configured webhooks for outbound email events.</p>
          <p>Configure `N8N_EMAIL_WEBHOOK_URL` and `N8N_EMAIL_WEBHOOK_SECRET` on the frontend container before enabling email delivery workflows.</p>
        </CardContent>
      </Card>
    </div>
  );
}
