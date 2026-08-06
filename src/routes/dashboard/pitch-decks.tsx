import { createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink, FileBarChart, Plus, Send, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { STI_ELECTRICAL_PHASE_2_DECK } from "@/lib/pitch-deck-content";

export const Route = createFileRoute("/dashboard/pitch-decks")({
  head: () => ({ meta: [{ title: "Pitch Decks - CloudMonkey Admin" }] }),
  component: PitchDecksPage,
});

type PitchDeck = {
  id: string;
  title: string;
  slug: string;
  publicToken: string;
  status: string;
  updatedAt: string;
  publicUrl: string;
  customer?: { name?: string; email?: string } | null;
};

function PitchDecksPage() {
  const { isAdmin, authReady } = useAdminAccess();
  const [rows, setRows] = useState<PitchDeck[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [audioDeckId, setAudioDeckId] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/pitch-decks");
    if (response.ok) setRows(await response.json());
  }
  if (authReady && !isAdmin) return <div className="p-8">Administrator access required.</div>;
  if (rows === null) {
    void load();
    return <div className="p-8 text-sm text-muted-foreground">Loading pitch decks…</div>;
  }

  async function createStiDeck() {
    setCreating(true);
    try {
      const response = await fetch("/api/admin/pitch-decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "sti-electrical-phase-2",
          title: "STI Electrical — Phase 2 ERP Proposal",
          content: STI_ELECTRICAL_PHASE_2_DECK,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create pitch deck");
      toast.success("STI Electrical pitch deck created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create pitch deck");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  }

  async function bootstrapSti() {
    setBootstrapping(true);
    try {
      const response = await fetch("/api/admin/pitch-decks/bootstrap-sti", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not prepare STI engagements");
      toast.success("STI Electrical and STI Risk drafts are ready");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare STI engagements");
    } finally {
      setBootstrapping(false);
    }
  }

  async function generateAudio(id: string) {
    setAudioDeckId(id);
    try {
      const response = await fetch(`/api/admin/pitch-decks/${encodeURIComponent(id)}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not generate voiceover");
      toast.success(`Generated ${body.generated?.length ?? 0} slide voiceovers`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate voiceover");
    } finally {
      setAudioDeckId(null);
    }
  }

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <PageHeader
        title="Pitch Decks"
        subtitle="Create and share transparent, presentation-style proposals with customers."
      />
      <Card className="border-[#dfe4ef] bg-white">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Customer presentations</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Public links are view-only and can be opened without a CloudMonkey login.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={bootstrapSti} disabled={bootstrapping}>
              {bootstrapping ? "Preparing…" : "Prepare STI engagements"}
            </Button>
            <Button onClick={createStiDeck} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "Creating…" : "Create STI deck"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dfe4ef] p-8 text-center text-sm text-muted-foreground">
              No pitch decks yet. Create the STI Electrical deck to generate its share link.
            </div>
          ) : (
            rows.map((deck) => (
              <div
                key={deck.id}
                className="flex flex-col gap-4 rounded-xl border border-[#dfe4ef] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-[#eeeaff] p-3 text-[#5d2fe8]">
                    <FileBarChart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-[#07102c]">{deck.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {deck.customer?.name || "Customer-linked deck"}
                      {deck.customer?.email ? ` · ${deck.customer.email}` : ""}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={deck.status === "published" ? "default" : "outline"}>
                        {deck.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Updated {new Date(deck.updatedAt).toLocaleDateString("en-ZA")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => copyLink(deck.publicUrl)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={deck.publicUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open deck
                    </a>
                  </Button>
                  {deck.status === "published" && (
                    <Button
                      variant="outline"
                      onClick={() => generateAudio(deck.id)}
                      disabled={audioDeckId === deck.id}
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      {audioDeckId === deck.id ? "Generating…" : "Voiceover"}
                    </Button>
                  )}
                  <Button asChild>
                    <a
                      href={`mailto:accounts@stielectrical.co.za?subject=${encodeURIComponent(deck.title)}&body=${encodeURIComponent(`Please review the proposal presentation: ${deck.publicUrl}`)}`}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Email link
                    </a>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
