import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Bot,
  FileText,
  LifeBuoy,
  MessageSquareWarning,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
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

type TicketSummary = {
  id: string;
  subject: string;
  description?: string | null;
  priority: string;
  status: string;
  category: string;
  source?: string | null;
  assignedToUserId?: string | null;
  updatedAt: string;
  user?: { email?: string | null } | null;
  comments?: unknown[] | null;
};

type CustomerOption = { id: string; name: string; email: string; role: string };

function SupportPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [queueView, setQueueView] = useState("all");
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");

  const { data: tickets, isLoading } = useQuery<TicketSummary[]>({
    queryKey: [isAdmin ? "admin" : "user", "tickets"],
    queryFn: async () => {
      const res = await fetch(isAdmin ? "/api/admin/tickets" : "/api/user/tickets");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json() as Promise<TicketSummary[]>;
    },
  });

  const { data: customers } = useQuery<CustomerOption[]>({
    queryKey: ["admin", "customer-options"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch("/api/admin/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      const rows = await res.json();
      return rows.filter((row: CustomerOption) => row.role === "customer");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(isAdmin ? "/api/admin/tickets" : "/api/user/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: isAdmin ? customerId : session?.user?.id,
          subject,
          description,
          priority,
          status: "open",
          category,
        }),
      });
      if (!res.ok) throw new Error("Failed to create ticket");
      return res.json();
    },
    onSuccess: () => {
      setSubject("");
      setDescription("");
      setPriority("medium");
      setCategory("general");
      setCustomerId("");
      toast.success("Ticket opened");
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "tickets"] });
    },
    onError: () => toast.error("Could not open ticket"),
  });

  const openCount =
    tickets?.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length ?? 0;
  const urgentCount =
    tickets?.filter((ticket) => ["high", "urgent"].includes(ticket.priority)).length ?? 0;
  const resolvedCount =
    tickets?.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed")
      .length ?? 0;
  const aiCount = tickets?.filter((ticket) => ticket.source === "ai_chat").length ?? 0;
  const filteredTickets = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (tickets ?? []).filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      if (sourceFilter !== "all" && (ticket.source ?? "manual") !== sourceFilter) return false;
      if (queueView === "unassigned" && ticket.assignedToUserId) return false;
      if (queueView === "mine" && ticket.assignedToUserId !== session?.user?.id) return false;
      if (!text) return true;
      return [ticket.subject, ticket.description, ticket.category, ticket.user?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [priorityFilter, query, queueView, session?.user?.id, sourceFilter, statusFilter, tickets]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title={<>Support queue.</>}
        subtitle="Review open tickets, priorities, owners, and case history."
      />
      {isAdmin && (
        <div className="flex justify-end">
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/dashboard/support/notifications">
              <BellRing className="h-4 w-4" />
              Service notifications & status page
            </Link>
          </Button>
        </div>
      )}

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

      <Card className="overflow-hidden rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader className="border-b border-[#e7ebf3] bg-[#f7f9fd]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--ai)]/10 text-[var(--ai)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Open a ticket</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Capture the issue, impact, category, and priority for the helpdesk queue.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#dfe4ef] bg-white px-3 py-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
              Structured requests are easier to resolve
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form
            className="grid gap-4 xl:grid-cols-[1.1fr_170px_170px] xl:items-start"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-4 xl:row-span-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Briefly describe the request"
                  required
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add context, deliverables, dates, links, and any steps already taken."
                  className="min-h-36 rounded-lg"
                />
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
                  required
                >
                  <option value="">Select customer</option>
                  {(customers ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {customer.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
              >
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="domains">Domains</option>
                <option value="hosting">Hosting</option>
                <option value="websites">Websites</option>
                <option value="support">Support</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="hidden space-y-2 xl:block">
              <Label>Ticket quality</Label>
              <div className="rounded-lg border border-dashed border-[#d8deea] bg-[#fbfcff] p-3 text-xs leading-relaxed text-muted-foreground">
                Use a clear action title, then put details and deliverables in the description.
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 self-end rounded-lg bg-[var(--ai)]"
              disabled={createMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              Open ticket
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_150px_150px_150px_150px]">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-white px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tickets"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <select
              value={queueView}
              onChange={(event) => setQueueView(event.target.value)}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="all">All queue</option>
              <option value="mine">My queue</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              <option value="ai_chat">AI chat</option>
              <option value="system">System</option>
            </select>
          </div>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading tickets...</div>
          ) : !tickets?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No support tickets have been opened.
            </div>
          ) : !filteredTickets.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No tickets match the selected filters.
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 transition hover:border-[var(--ai)]/30 hover:bg-[#fbfcff] lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="font-semibold text-foreground">{ticket.subject}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {ticket.user?.email || session?.user?.email} · {ticket.category} ·{" "}
                    {new Date(ticket.updatedAt).toLocaleString()}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{ticket.priority}</Badge>
                    <Badge variant={ticket.status === "resolved" ? "secondary" : "outline"}>
                      {ticket.status}
                    </Badge>
                    <Badge variant="outline">{ticket.source ?? "manual"}</Badge>
                    <Badge variant="outline">{ticket.comments?.length ?? 0} comments</Badge>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-lg">
                  <Link to="/dashboard/support/$ticketId" params={{ ticketId: ticket.id }}>
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Outlet />
    </div>
  );
}
