import {
  ArrowRight,
  ChevronDown,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import mascot from "@/assets/cm-mascot.png";
import { authClient } from "@/lib/auth-client";
import {
  clearCaesarSession,
  claimCaesarSession,
  loadCaesarSession,
  storeCaesarSession,
  type StoredCaesarSession,
} from "@/lib/caesar-client";

type CaesarAction = { label: string; href: string };
type CaesarMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  suggestedActions?: CaesarAction[];
};

type CaesarQualification = {
  fullName?: string | null;
  email?: string | null;
  company?: string | null;
  country?: string | null;
  serviceInterests?: string[];
  businessNeed?: string | null;
  consentToContact?: boolean;
};

const QUICK_STARTS = [
  "Help me choose a service",
  "I need a website or app",
  "I want to automate my business",
  "Help me find a domain",
] as const;

const QUALIFICATION_FIELDS: Array<keyof CaesarQualification> = [
  "fullName",
  "email",
  "company",
  "country",
  "serviceInterests",
  "businessNeed",
];

function qualificationProgress(qualification: CaesarQualification) {
  const completed = QUALIFICATION_FIELDS.filter((field) => {
    const value = qualification[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }).length;
  return Math.round((completed / QUALIFICATION_FIELDS.length) * 100);
}

export function CaesarChat() {
  const { data: userSession } = authClient.useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [session, setSession] = useState<StoredCaesarSession | null>(null);
  const [messages, setMessages] = useState<CaesarMessage[]>([]);
  const [qualification, setQualification] = useState<CaesarQualification>({});
  const [leadReady, setLeadReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const hasStartedRef = useRef(false);

  async function resume(existing: StoredCaesarSession | null, allowRetry = true) {
    const response = await fetch("/api/public/caesar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume", ...existing }),
    });
    if (!response.ok && existing && allowRetry && [403, 404].includes(response.status)) {
      clearCaesarSession();
      return resume(null, false);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Caesar could not start");
    const nextSession = { sessionId: body.sessionId, sessionToken: body.sessionToken };
    storeCaesarSession(nextSession);
    setSession(nextSession);
    const history = (body.messages ?? []) as CaesarMessage[];
    if (!history.length && body.welcome?.reply) {
      history.push({
        id: "caesar-welcome",
        role: "assistant",
        body: body.welcome.reply,
        suggestedActions: body.welcome.suggestedActions,
      });
    }
    setMessages(history);
    setQualification(body.qualification ?? {});
    setLeadReady(Boolean(body.leadReady));
  }

  useEffect(() => {
    if (!isOpen || hasStartedRef.current) return;
    hasStartedRef.current = true;
    resume(loadCaesarSession())
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Caesar could not start"))
      .finally(() => setIsReady(true));
  }, [isOpen]);

  useEffect(() => {
    if (!userSession || !session) return;
    claimCaesarSession().catch(() => undefined);
  }, [session, userSession]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => scrollAnchorRef.current?.scrollIntoView({ block: "end" }));
  }, [isOpen, isSending, messages]);

  async function sendMessage(nextMessage = message) {
    const trimmed = nextMessage.trim();
    if (!trimmed || !session || isSending) return;
    setIsSending(true);
    setError(null);
    setMessage("");
    const optimistic: CaesarMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      body: trimmed,
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const response = await fetch("/api/public/caesar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", ...session, message: trimmed }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Caesar could not answer");
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimistic.id),
        body.message,
        {
          ...body.reply,
          suggestedActions: body.reply?.suggestedActions ?? [],
        },
      ]);
      setQualification(body.qualification ?? {});
      setLeadReady(Boolean(body.leadReady));
    } catch (cause) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setMessage(trimmed);
      setError(cause instanceof Error ? cause.message : "Caesar could not answer");
    } finally {
      setIsSending(false);
    }
  }

  const progress = qualificationProgress(qualification);

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section className="mb-3 flex h-[min(690px,calc(100vh-7rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[1.75rem] border border-[#d9dded] bg-[#fbfcff] shadow-[0_30px_90px_-30px_rgba(7,16,44,.55)] sm:w-[430px]">
          <header className="relative overflow-hidden bg-[#07102c] px-5 pb-5 pt-4 text-white">
            <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[#6d34f7]/45 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-white">
                  <img src={mascot} alt="Caesar, CloudMonkey digital guide" className="h-full w-full object-cover object-top" />
                  <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2ed47a]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-lg font-extrabold">
                    Caesar <Sparkles className="h-4 w-4 text-[#55d4e9]" />
                  </div>
                  <p className="text-xs font-semibold text-white/60">Sales &amp; marketing guide</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close Caesar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#55d4e9,#8b5cf6)] transition-[width] duration-500"
                  style={{ width: `${Math.max(8, progress)}%` }}
                />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-white/55">
                {leadReady ? "Ready to register" : `${progress}% mapped`}
              </span>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {!isReady ? (
              <div className="flex h-full items-center justify-center text-sm text-[#65708a]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--ai)]" /> Caesar is getting his notes.
              </div>
            ) : (
              <>
                {messages.map((item) => (
                  <div key={item.id} className={item.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className="max-w-[88%]">
                      <div
                        className={
                          item.role === "user"
                            ? "rounded-2xl rounded-br-md bg-[var(--ai)] px-4 py-3 text-sm leading-6 text-white"
                            : "rounded-2xl rounded-bl-md border border-[#e1e5f0] bg-white px-4 py-3 text-sm leading-6 text-[#26314e] shadow-sm"
                        }
                      >
                        {item.body}
                      </div>
                      {item.role === "assistant" && item.suggestedActions?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.suggestedActions.map((action) => (
                            <a
                              key={`${item.id}-${action.href}-${action.label}`}
                              href={action.href}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#cfd5e6] bg-white px-3 py-2 text-xs font-bold text-[#3c4764] transition hover:border-[var(--ai)] hover:text-[var(--ai)]"
                            >
                              {action.label} <ArrowRight className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {messages.length <= 1 && (
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_STARTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="rounded-xl border border-[#dce1ee] bg-white p-3 text-left text-xs font-bold leading-5 text-[#4a5570] transition hover:-translate-y-0.5 hover:border-[var(--ai)] hover:text-[var(--ai)]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e1e5f0] bg-white px-4 py-3 text-xs font-semibold text-[#65708a] shadow-sm">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ai)]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ai)] [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ai)] [animation-delay:240ms]" />
                      Caesar is thinking
                    </div>
                  </div>
                )}
                <div ref={scrollAnchorRef} />
              </>
            )}
          </div>

          <footer className="border-t border-[#e1e5f0] bg-white p-3">
            {error && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
            <form
              className="flex items-end gap-2 rounded-2xl border border-[#d7ddeb] bg-[#f8f9fd] p-2 focus-within:border-[var(--ai)]"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, 800))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Tell Caesar what your business needs..."
                rows={1}
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#17213a] outline-none placeholder:text-[#8b94aa]"
                disabled={!isReady || isSending}
              />
              <button
                type="submit"
                disabled={!message.trim() || !isReady || isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ai)] text-white transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message to Caesar"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] leading-4 text-[#7c869e]">
              <LockKeyhole className="h-3 w-3" /> CloudMonkey guidance only. Details are saved only with your consent.
            </div>
          </footer>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group ml-auto flex items-center gap-3 rounded-full border border-white/40 bg-[#07102c] py-2 pl-2 pr-4 text-left text-white shadow-[0_18px_48px_-18px_rgba(7,16,44,.8)] transition hover:-translate-y-0.5"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close Caesar" : "Chat with Caesar"}
      >
        <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white">
          <img src={mascot} alt="" className="h-full w-full object-cover object-top" />
          <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2ed47a]" />
        </span>
        <span className="hidden sm:block">
          <span className="block text-xs font-extrabold">Ask Caesar</span>
          <span className="block text-[10px] text-white/55">Let’s find your next move</span>
        </span>
        {isOpen ? <ChevronDown className="hidden h-4 w-4 text-white/60 sm:block" /> : <MessageCircle className="hidden h-4 w-4 text-[#55d4e9] sm:block" />}
      </button>
    </div>
  );
}
