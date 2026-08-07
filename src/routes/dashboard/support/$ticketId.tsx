import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Bot,
  CreditCard,
  Globe,
  type LucideIcon,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Sparkles,
  Server,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/support/$ticketId")({
  head: () => ({
    meta: [{ title: "Support ticket - CloudMonkey Dashboard" }],
  }),
  component: TicketDetailPanel,
});

type TicketComment = {
  id: string;
  body: string;
  isInternal?: boolean;
  createdAt: string;
};

type TicketDetail = {
  id: string;
  userId: string;
  subject: string;
  description?: string | null;
  priority: string;
  status: string;
  category: string;
  source?: string | null;
  updatedAt: string;
  user?: { email?: string | null } | null;
  comments?: TicketComment[] | null;
};

type CrmContext = {
  user?: { email?: string | null; name?: string | null } | null;
  invoices?: Array<{ status?: string | null }> | null;
  subscriptions?: unknown[] | null;
  domains?: unknown[] | null;
  websites?: unknown[] | null;
  servers?: unknown[] | null;
  agents?: unknown[] | null;
};

type TicketAiSummary = {
  summary: string;
  generatedAt: string;
};

function TicketDetailPanel() {
  const { ticketId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "owner";
  const ticketBasePath = isAdmin
    ? `/api/admin/tickets/${ticketId}`
    : `/api/user/tickets/${ticketId}`;
  const [comment, setComment] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: [isAdmin ? "admin" : "user", "tickets", ticketId],
    queryFn: async () => {
      const res = await fetch(ticketBasePath);
      if (!res.ok) throw new Error("Failed to fetch ticket");
      return res.json() as Promise<TicketDetail>;
    },
    enabled: !isPending,
  });

  const { data: crmContext } = useQuery<CrmContext>({
    queryKey: ["admin", "users", ticket?.userId, "support-context"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${ticket.userId}`);
      if (!res.ok) throw new Error("Failed to fetch customer context");
      return res.json() as Promise<CrmContext>;
    },
    enabled: isAdmin && !!ticket?.userId,
  });

  const aiSummaryQuery = useQuery<TicketAiSummary>({
    queryKey: ["admin", "tickets", ticketId, "ai-summary", ticket?.updatedAt],
    queryFn: async () => {
      const res = await fetch(`${ticketBasePath}/ai-summary`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not generate the AI ticket summary");
      return body as TicketAiSummary;
    },
    enabled: isAdmin && !!ticket,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await fetch(ticketBasePath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to update ticket");
      return body;
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({
        queryKey: [isAdmin ? "admin" : "user", "tickets", ticketId],
      });
      queryClient.invalidateQueries({ queryKey: [isAdmin ? "admin" : "user", "tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${ticketBasePath}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment, isInternal: isAdmin && isInternal }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      return res.json();
    },
    onSuccess: () => {
      setComment("");
      setIsInternal(false);
      toast.success("Comment added");
      queryClient.invalidateQueries({
        queryKey: [isAdmin ? "admin" : "user", "tickets", ticketId],
      });
    },
    onError: () => toast.error("Could not add comment"),
  });

  const aiInstructionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${ticketBasePath}/ai-instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: aiInstruction }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "AI instruction failed");
      return body;
    },
    onSuccess: () => {
      setAiInstruction("");
      toast.success("AI instruction completed and linked to the ticket");
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets", ticketId] });
    },
  });

  const publishNoteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`${ticketBasePath}/comments/${commentId}/publish`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not publish note");
      return body;
    },
    onSuccess: () => {
      toast.success("Note is now public to the customer");
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets", ticketId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const customerLabel = ticket?.user?.email || crmContext?.user?.email || "Customer";

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-lg border border-[#dfe4ef] bg-white shadow-2xl">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#07102c]">
              {ticket?.subject || "Support ticket"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{customerLabel}</div>
          </div>
          <Maximize2 className="h-4 w-4 shrink-0 text-[var(--ai)]" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute inset-0 bg-[#07102c]/20 backdrop-blur-[1px] pointer-events-auto" />
      <section
        className="pointer-events-auto fixed inset-0 flex flex-col overflow-hidden border border-[#dfe4ef] bg-white shadow-2xl"
      >
        <div className="border-b border-[#e7ebf3] bg-[#f7f9fd] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{ticket?.priority ?? "loading"}</Badge>
                <Badge variant={ticket?.status === "resolved" ? "secondary" : "outline"}>
                  {ticket?.status ?? "loading"}
                </Badge>
                {ticket?.category && <Badge variant="outline">{ticket.category}</Badge>}
              </div>
              <h2 className="mt-3 line-clamp-2 text-lg font-bold leading-snug text-[#07102c]">
                {isLoading ? "Loading ticket..." : ticket?.subject || ticketId}
              </h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">{customerLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton label="Minimize ticket" onClick={() => setIsMinimized(true)}>
                <Minimize2 className="h-4 w-4" />
              </IconButton>
              <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                <Link to="/dashboard/support" aria-label="Close ticket">
                  <X className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-5 xl:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#07102c]">Case details</div>
                    <div className="text-xs text-muted-foreground">
                      {ticket?.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ""}
                    </div>
                  </div>
                  <FormattedTicketText text={ticket?.description || "No description provided."} />
                  {isAdmin && ticket && (
                    <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                      <select
                        value={ticket.status}
                        onChange={(event) => updateMutation.mutate({ status: event.target.value })}
                        className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <select
                        value={ticket.priority}
                        onChange={(event) =>
                          updateMutation.mutate({ priority: event.target.value })
                        }
                        className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <select
                        value={ticket.category}
                        onChange={(event) =>
                          updateMutation.mutate({ category: event.target.value })
                        }
                        className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
                      >
                        <option value="general">General</option>
                        <option value="billing">Billing</option>
                        <option value="domains">Domains</option>
                        <option value="hosting">Hosting</option>
                        <option value="websites">Websites</option>
                        <option value="support">Support</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {isAdmin && (
                <Card className="rounded-lg border-[var(--ai)]/25 bg-[var(--ai-soft)]/35 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-[var(--ai)]/10 p-2 text-[var(--ai)]">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#07102c]">
                          AI ticket context
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          The agent first checks the ticket against available customer records and
                          suggests possible resolution points. This review is read-only.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--ai)]/20 bg-white p-4">
                      {aiSummaryQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock3 className="h-4 w-4 animate-spin text-[var(--ai)]" />
                          Checking ticket and customer records...
                        </div>
                      ) : aiSummaryQuery.isError ? (
                        <div className="space-y-3">
                          <p className="text-sm text-destructive">
                            {aiSummaryQuery.error instanceof Error
                              ? aiSummaryQuery.error.message
                              : "Could not generate the AI ticket summary"}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => aiSummaryQuery.refetch()}
                          >
                            Try summary again
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <FormattedTicketText
                            text={aiSummaryQuery.data?.summary || "No relevant context was found."}
                            compact
                          />
                          <button
                            type="button"
                            className="text-xs font-semibold text-[var(--ai)] hover:underline"
                            disabled={aiSummaryQuery.isFetching}
                            onClick={() => aiSummaryQuery.refetch()}
                          >
                            {aiSummaryQuery.isFetching
                              ? "Refreshing..."
                              : "Refresh database summary"}
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-2 text-sm font-semibold text-[#07102c]">
                        Manual instruction
                      </div>
                      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                        Add the action the agent should take. Its outcome is linked to this ticket
                        as a private note by default.
                      </p>
                      <Textarea
                        value={aiInstruction}
                        onChange={(event) => setAiInstruction(event.target.value)}
                        placeholder="Example: Verify the invoice and apply the approved credit, then report the outcome."
                        className="min-h-28 rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        className="rounded-lg bg-[var(--ai)]"
                        disabled={
                          aiInstruction.trim().length < 3 || aiInstructionMutation.isPending
                        }
                        onClick={() => aiInstructionMutation.mutate()}
                      >
                        {aiInstructionMutation.isPending ? (
                          <Clock3 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {aiInstructionMutation.isPending ? "Agent working..." : "Run instruction"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="text-sm font-semibold text-[#07102c]">Comments</div>
                  {!ticket?.comments?.length ? (
                    <div className="rounded-lg border border-dashed border-[#dfe4ef] bg-[#fbfcff] p-4 text-sm text-muted-foreground">
                      No comments have been added.
                    </div>
                  ) : (
                    ticket.comments.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-lg border border-border p-3"
                      >
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ai)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.isInternal && <Badge variant="outline">Internal</Badge>}
                            <div className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString()}
                            </div>
                          </div>
                          {isAdmin && item.isInternal && (
                            <button
                              type="button"
                              className="mt-2 text-xs font-semibold text-[var(--ai)] hover:underline disabled:opacity-50"
                              disabled={publishNoteMutation.isPending}
                              onClick={() => publishNoteMutation.mutate(item.id)}
                            >
                              Make public
                            </button>
                          )}
                          <div className="mt-2">
                            <FormattedTicketText text={item.body} compact />
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  <form
                    className="space-y-3 border-t border-border pt-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      commentMutation.mutate();
                    }}
                  >
                    <Textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add a reply or internal note"
                      className="min-h-24 rounded-lg"
                      required
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {isAdmin && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={(event) => setIsInternal(event.target.checked)}
                          />
                          Internal note
                        </label>
                      )}
                      <Button
                        type="submit"
                        className="rounded-lg bg-[var(--ai)]"
                        disabled={commentMutation.isPending}
                      >
                        <MessageSquareText className="h-4 w-4" />
                        Add comment
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-3">
              {isAdmin && crmContext ? (
                <>
                  <ContextCard
                    icon={UserRound}
                    title="Customer"
                    value={crmContext.user?.email ?? "Unknown"}
                    detail={crmContext.user?.name ?? "No name"}
                  />
                  <ContextCard
                    icon={CreditCard}
                    title="Invoices"
                    value={String(
                      crmContext.invoices?.filter((item) => item.status !== "void").length ?? 0,
                    )}
                    detail={`${crmContext.subscriptions?.length ?? 0} subscriptions`}
                  />
                  <ContextCard
                    icon={Globe}
                    title="Domains"
                    value={String(crmContext.domains?.length ?? 0)}
                    detail={`${crmContext.websites?.length ?? 0} websites`}
                  />
                  <ContextCard
                    icon={Server}
                    title="Servers"
                    value={String(crmContext.servers?.length ?? 0)}
                    detail={`${crmContext.agents?.length ?? 0} agents`}
                  />
                </>
              ) : (
                <Card className="rounded-lg border-[#dfe4ef] bg-[#fbfcff] shadow-sm">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    Customer context appears here for admin users.
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-lg"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

function FormattedTicketText({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks = useMemo(() => parseTicketText(text), [text]);

  return (
    <div
      className={cn("space-y-3 text-sm leading-6 text-[#243047]", compact && "space-y-2 leading-5")}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={index}
              className={cn("pt-1 text-sm font-semibold text-[#07102c]", compact && "pt-0")}
            >
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-disc pl-1">
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ordered-list") {
          return (
            <ol key={index} className="space-y-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-decimal pl-1">
                  {item}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function parseTicketText(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<
    | { type: "heading" | "paragraph"; text: string }
    | { type: "list" | "ordered-list"; items: string[] }
  > = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };
  const flushLists = () => {
    if (listItems.length) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
    if (orderedItems.length) {
      blocks.push({ type: "ordered-list", items: orderedItems });
      orderedItems = [];
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushLists();
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet) {
      flushParagraph();
      orderedItems = [];
      listItems.push(bullet[1]);
      return;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)/);
    if (ordered) {
      flushParagraph();
      listItems = [];
      orderedItems.push(ordered[1]);
      return;
    }

    flushLists();
    const looksLikeHeading = line.length <= 72 && !/[.!?]$/.test(line) && !line.includes(": ");
    if (looksLikeHeading) {
      flushParagraph();
      blocks.push({ type: "heading", text: line.replace(/:$/, "") });
    } else {
      paragraph.push(line);
    }
  });

  flushParagraph();
  flushLists();
  return blocks;
}

function ContextCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-lg border-[#dfe4ef] bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{title}</div>
            <div className="mt-1 truncate text-sm font-bold text-[#07102c]">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
          </div>
          <Icon className="h-4 w-4 shrink-0 text-[var(--ai)]" />
        </div>
      </CardContent>
    </Card>
  );
}
