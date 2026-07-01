import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, LifeBuoy, MessageSquareWarning, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/support")({
  head: () => ({
    meta: [{ title: "Support - CloudMonkey Dashboard" }],
  }),
  component: SupportPage,
});

function SupportPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [query, setQuery] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: [isAdmin ? "admin" : "user", "tickets"],
    queryFn: async () => {
      const res = await fetch(isAdmin ? "/api/admin/tickets" : "/api/user/tickets");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(isAdmin ? "/api/admin/tickets" : "/api/user/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session?.user?.id, subject, description, priority, status: "open", category: "general" }),
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      return res.json();
    },
    onSuccess: () => {
      setSubject("");
      setDescription("");
      toast.success("Ticket opened");
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "tickets"] });
    },
    onError: () => toast.error("Could not open ticket"),
  });

  const openCount = tickets?.filter((ticket: any) => !["resolved", "closed"].includes(ticket.status)).length ?? 0;
  const urgentCount = tickets?.filter((ticket: any) => ["high", "urgent"].includes(ticket.priority)).length ?? 0;
  const resolvedCount = tickets?.filter((ticket: any) => ticket.status === "resolved" || ticket.status === "closed").length ?? 0;
  const aiCount = tickets?.filter((ticket: any) => ticket.source === "ai_chat").length ?? 0;
  const filteredTickets = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (tickets ?? []).filter((ticket: any) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      if (sourceFilter !== "all" && (ticket.source ?? "manual") !== sourceFilter) return false;
      if (!text) return true;
      return [ticket.subject, ticket.description, ticket.category, ticket.user?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [priorityFilter, query, sourceFilter, statusFilter, tickets]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title={<>Support queue.</>}
        subtitle="Review open tickets, priorities, owners, and case history."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Open tickets", value: openCount, icon: LifeBuoy },
          { label: "High priority", value: urgentCount, icon: MessageSquareWarning },
          { label: "Resolved", value: resolvedCount, icon: LifeBuoy },
          { label: "AI created", value: aiCount, icon: Bot },
        ].map((item) => (
          <Card key={item.label} className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-2 text-3xl font-bold text-foreground">{item.value}</div>
                </div>
                <item.icon className="h-5 w-5 text-[var(--ai)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Open a ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[1fr_1.5fr_160px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-9" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <Button type="submit" className="self-end rounded-lg bg-[var(--ai)]" disabled={createMutation.isPending}>
              <Plus className="h-4 w-4" />
              Open
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_150px_150px_150px]">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-white px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tickets"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="h-10 rounded-lg border border-input bg-white px-3 text-sm">
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              <option value="ai_chat">AI chat</option>
              <option value="system">System</option>
            </select>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading tickets...</div>
          ) : !tickets?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No support tickets have been opened.</div>
          ) : !filteredTickets.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No tickets match the selected filters.</div>
          ) : filteredTickets.map((ticket: any) => (
            <div key={ticket.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold text-foreground">{ticket.subject}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {ticket.user?.email || session?.user?.email} · {ticket.category} · {new Date(ticket.updatedAt).toLocaleString()}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{ticket.priority}</Badge>
                  <Badge variant={ticket.status === "resolved" ? "secondary" : "outline"}>{ticket.status}</Badge>
                  <Badge variant="outline">{ticket.source ?? "manual"}</Badge>
                  <Badge variant="outline">{ticket.comments?.length ?? 0} comments</Badge>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-lg">
                <Link to="/dashboard/support/$ticketId" params={{ ticketId: ticket.id }}>
                  View <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="text-sm font-semibold text-[#07102c]">Ticket detail</div>
        <Outlet />
      </div>
    </div>
  );
}
