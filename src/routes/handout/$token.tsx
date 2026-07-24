import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/handout/$token")({ component: HandoutPage });

function HandoutPage() {
  const { token } = Route.useParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [credentials, setCredentials] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const query = useQuery({
    queryKey: ["handout", token],
    queryFn: async () => {
      const response = await fetch(`/api/public/handout/${encodeURIComponent(token)}/consume`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Link unavailable");
      return body;
    },
  });
  async function submit() {
    setSubmitError("");
    const form = new FormData();
    form.set("credentials", credentials);
    if (fileRef.current?.files?.[0]) form.set("file", fileRef.current.files[0]);
    const response = await fetch(`/api/public/handout/${encodeURIComponent(token)}/submit`, { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) { setSubmitError(body.error ?? "Submission failed"); return; }
    setSubmitted(true);
  }
  const isRequest = query.data?.mode === "request";
  return <main className="mx-auto max-w-3xl px-6 py-16">
    <Card><CardHeader><CardTitle>{isRequest ? "Secure CloudMonkey handoff" : "Secure CloudMonkey handout"}</CardTitle></CardHeader><CardContent className="space-y-5">
      {query.isPending && <p>Checking secure link…</p>}
      {query.isError && <p className="text-red-600">{(query.error as Error).message}</p>}
      {isRequest && !submitted && <>
        <p className="text-sm text-muted-foreground">Send CloudMonkey the requested logos, documents, or credentials. This link expires and the submission is encrypted at rest.</p>
        <textarea value={credentials} onChange={(event) => setCredentials(event.target.value)} placeholder="Credentials or handoff notes (optional if uploading a file)" className="min-h-32 w-full rounded-md border bg-background p-3 text-sm" />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" className="block w-full text-sm" />
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <Button onClick={submit}>Send securely</Button>
      </>}
      {isRequest && submitted && <p className="text-green-700">Your handoff was submitted securely. CloudMonkey can now continue the setup.</p>}
      {!isRequest && query.data?.handout && <pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(query.data.handout, null, 2)}</pre>}
    </CardContent></Card>
  </main>;
}
