import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Play,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatAttachment = {
  id: string;
  kind: "image" | "audio" | string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  url: string;
  transcript?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  ticketId?: string;
  attachments?: ChatAttachment[];
  suggestedActions?: { label: string; href: string }[];
  audioReplyText?: string;
};

export function FloatingSupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsOpen(localStorage.getItem("cloudmonkey:support-chat-open") === "1");
  }, []);

  function setOpen(value: boolean) {
    setIsOpen(value);
    localStorage.setItem("cloudmonkey:support-chat-open", value ? "1" : "0");
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      if (sessionId) formData.set("sessionId", sessionId);
      files.forEach((file) => formData.append("files", file));
      const res = await fetch("/api/user/support-chat/uploads", {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed");
      setSessionId(body.session?.id ?? sessionId);
      setPendingAttachments((current) => [...current, ...(body.attachments ?? [])]);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        });
        uploadFiles([file]);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setOpen(true);
    } catch {
      toast.error("Microphone access was not allowed");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      toast.error("Voice playback is not supported in this browser");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  const chatMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message,
          attachmentIds: pendingAttachments.map((attachment) => attachment.id),
          clientCapabilities: {
            audioReply: "speechSynthesis" in window,
            imageUpload: true,
            voiceNotes: Boolean(navigator.mediaDevices),
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to contact support agent");
      return body;
    },
    onSuccess: (data) => {
      const sentMessage = message;
      const sentAttachments = pendingAttachments;
      setSessionId(data.session?.id ?? sessionId);
      setMessages((current) => [
        ...current,
        {
          id: data.messages?.[0]?.id ?? `local-user-${Date.now()}`,
          role: "user",
          body: sentMessage,
          attachments: sentAttachments,
        },
        {
          id: data.messages?.[1]?.id ?? `local-assistant-${Date.now()}`,
          role: "assistant",
          body: data.reply,
          ticketId: data.ticket?.id,
          suggestedActions: data.suggestedActions ?? [],
          audioReplyText: data.audioReplyText,
        },
      ]);
      setMessage("");
      setPendingAttachments([]);
      if (data.ticket?.id) toast.success("Support ticket linked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quickPrompts = [
    "Help me choose a product",
    "Check if a domain is available",
    "Show my DNS records",
    "I need billing help",
  ];
  const canSend = !!message.trim() || pendingAttachments.length > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section className="mb-3 flex max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-[#dfe4ef] bg-white shadow-[0_24px_80px_-30px_rgba(15,23,42,0.55)] sm:w-[420px]">
          <header className="flex items-start justify-between gap-3 border-b border-[#dfe4ef] p-4">
            <div>
              <div className="flex items-center gap-2 font-bold text-[#07102c]">
                <MessageSquare className="h-5 w-5 text-[var(--ai)]" />
                AI Support
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#4d5874]">
                Ask about signup, billing, domains, DNS, onboarding, or support.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden rounded-lg sm:inline-flex">
                Context aware
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close AI Support</span>
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-[#dfe4ef] px-3 py-2 text-xs font-semibold text-[#4d5874] hover:border-[var(--ai)] hover:text-[var(--ai)]"
                  onClick={() => setMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="min-h-[220px] space-y-3 rounded-lg border border-border bg-[#f8fafc] p-3">
              {!messages.length ? (
                <div className="flex min-h-[190px] flex-col items-center justify-center text-center">
                  <MessageSquare className="h-9 w-9 text-[var(--ai)]" />
                  <div className="mt-3 text-sm font-semibold text-[#07102c]">
                    Start with a question or upload context.
                  </div>
                  <div className="mt-1 max-w-sm text-xs text-[#58637e]">
                    Images and voice notes can be linked to a support case when needed.
                  </div>
                </div>
              ) : (
                messages.map((item) => <ChatBubble key={item.id} item={item} onSpeak={speak} />)
              )}
              {chatMutation.isPending && (
                <div className="mr-auto inline-flex items-center gap-2 rounded-lg bg-white p-3 text-sm text-[#4d5874] shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking through the next step...
                </div>
              )}
            </div>

            {pendingAttachments.length > 0 && (
              <div className="grid gap-2">
                {pendingAttachments.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() =>
                      setPendingAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <form
            className="space-y-3 border-t border-[#dfe4ef] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSend) return;
              chatMutation.mutate();
            }}
          >
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask CloudMonkey support..."
              className="min-h-20 rounded-lg"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,audio/webm,audio/mp4,audio/mpeg,audio/wav,audio/ogg"
                  className="hidden"
                  onChange={(event) => uploadFiles(Array.from(event.target.files ?? []))}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  disabled={isUploading || chatMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  Attach
                </Button>
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  className="rounded-lg"
                  disabled={isUploading || chatMutation.isPending}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {isRecording ? "Stop" : "Voice note"}
                </Button>
              </div>
              <Button
                type="submit"
                className="rounded-lg bg-[var(--ai)]"
                disabled={chatMutation.isPending || isUploading || !canSend}
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </form>
        </section>
      )}

      <Button
        type="button"
        className="ml-auto flex rounded-full bg-[var(--ai)] px-4 shadow-[0_18px_50px_-18px_rgba(93,47,232,0.85)]"
        onClick={() => setOpen(!isOpen)}
      >
        <MessageSquare className="h-4 w-4" />
        AI Support
      </Button>
    </div>
  );
}

function ChatBubble({ item, onSpeak }: { item: ChatMessage; onSpeak: (text: string) => void }) {
  const isUser = item.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-lg p-3 text-sm ${isUser ? "bg-[var(--ai)] text-white" : "bg-white text-[#07102c] shadow-sm"}`}
      >
        <div className="whitespace-pre-wrap break-words">{item.body}</div>
        {!!item.attachments?.length && (
          <div className="mt-3 grid gap-2">
            {item.attachments.map((attachment) => (
              <InlineAttachment key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}
        {!!item.suggestedActions?.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.suggestedActions.map((action) => (
              <Link
                key={`${action.label}-${action.href}`}
                to={action.href}
                className="rounded-md border border-[#dfe4ef] bg-white px-2 py-1 text-xs font-semibold text-[var(--ai)]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {item.ticketId && (
            <Link
              to="/dashboard/support/$ticketId"
              params={{ ticketId: item.ticketId }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ai)]"
            >
              <LifeBuoy className="h-3 w-3" />
              Open ticket
            </Link>
          )}
          {!isUser && (item.audioReplyText || item.body) && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ai)]"
              onClick={() => onSpeak(item.audioReplyText || item.body)}
            >
              <Volume2 className="h-3 w-3" />
              Play reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[#dfe4ef] bg-white p-3">
      <AttachmentIcon attachment={attachment} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#07102c]">{attachment.fileName}</div>
        <div className="text-xs text-[#58637e]">{formatBytes(attachment.sizeBytes)}</div>
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-[#58637e] hover:bg-muted"
        onClick={onRemove}
        aria-label="Remove attachment"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function InlineAttachment({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.kind === "image") {
    return (
      <img
        src={attachment.url}
        alt={attachment.fileName}
        className="max-h-52 rounded-lg border border-white/20 object-contain"
      />
    );
  }
  if (attachment.kind === "audio") {
    return <audio src={attachment.url} controls className="w-full" />;
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-xs font-semibold"
    >
      <Paperclip className="h-3.5 w-3.5" />
      {attachment.fileName}
    </a>
  );
}

function AttachmentIcon({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.kind === "image")
    return <ImageIcon className="h-5 w-5 shrink-0 text-[var(--ai)]" />;
  if (attachment.kind === "audio") return <Play className="h-5 w-5 shrink-0 text-[var(--ai)]" />;
  return <Paperclip className="h-5 w-5 shrink-0 text-[var(--ai)]" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
