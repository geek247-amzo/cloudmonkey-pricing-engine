import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/handout/$token")({ component: HandoutPage });

function HandoutPage() {
  const { token } = Route.useParams();
  const query = useQuery({ queryKey: ["handout", token], queryFn: async () => { const response = await fetch(`/api/public/handout/${encodeURIComponent(token)}/consume`, { method: "POST", headers: { "Content-Type": "application/json" } }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Link unavailable"); return body; } });
  return <main className="mx-auto max-w-3xl px-6 py-16"><Card><CardContent className="p-8">{query.isPending ? "Loading secure handout…" : query.isError ? <p className="text-red-600">{(query.error as Error).message}</p> : <pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(query.data.handout, null, 2)}</pre>}</CardContent></Card></main>;
}
