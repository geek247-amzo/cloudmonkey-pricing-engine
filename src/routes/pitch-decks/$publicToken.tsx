import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  ExternalLink,
  Maximize2,
  Menu,
  Minimize2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRef } from "react";

import logo from "@/assets/cm-logo.png";
import type { PitchDeckContent, PitchDeckSlide } from "@/lib/pitch-deck-content";

export const Route = createFileRoute("/pitch-decks/$publicToken")({
  head: () => ({
    meta: [
      { title: "STI Electrical — On-site ERP Enablement | CloudMonkey" },
      {
        name: "description",
        content:
          "A transparent Phase 2 ERP close-out and business optimisation proposal for STI Electrical.",
      },
    ],
  }),
  component: PitchDeckPage,
});

type DeckResponse = { id: string; title: string; content: PitchDeckContent };

async function fetchDeck(token: string): Promise<DeckResponse> {
  const response = await fetch(`/api/pitch-decks/${encodeURIComponent(token)}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "This pitch deck is unavailable");
  return body as DeckResponse;
}

function PitchDeckPage() {
  const { publicToken } = Route.useParams();
  const [deck, setDeck] = useState<DeckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchDeck(publicToken)
      .then(setDeck)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load deck"),
      );
  }, [publicToken]);

  const slides = deck?.content.slides ?? [];
  const slide = slides[active];
  const progress = slides.length ? ((active + 1) / slides.length) * 100 : 0;
  const go = (index: number) => setActive(Math.max(0, Math.min(slides.length - 1, index)));

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        go(active + 1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(active - 1);
      }
      if (event.key === "Home") go(0);
      if (event.key === "End") go(slides.length - 1);
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, slides.length]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [active]);

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070d23] p-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/15 bg-white/10 p-8 text-center">
          <h1 className="text-xl font-bold">Pitch deck unavailable</h1>
          <p className="mt-3 text-white/65">{error}</p>
        </div>
      </div>
    );
  if (!deck || !slide)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070d23] text-white">
        <div className="animate-pulse text-sm text-white/70">Loading CloudMonkey pitch deck…</div>
      </div>
    );

  return (
    <div className="min-h-screen overflow-hidden bg-[#070d23] text-white selection:bg-[#a895ff] selection:text-[#070d23]">
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-[#7b4dff] via-[#4cc9f0] to-[#f5bd4d] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-5 py-5">
        <img
          src={logo}
          alt="CloudMonkey"
          className="h-12 w-12 drop-shadow-[0_8px_20px_rgba(116,69,255,.45)] sm:h-14 sm:w-14"
        />
      </div>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="fixed right-5 top-5 z-40 rounded-full border border-white/15 bg-white/8 p-3 text-white/80 transition hover:bg-white/15 sm:right-10"
        aria-label="Open slide overview"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className="fixed right-20 top-5 z-40 rounded-full border border-white/15 bg-white/8 p-3 text-white/80 transition hover:bg-white/15 sm:right-28"
        aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
        title={isFullscreen ? "Exit full screen" : "Present full screen"}
      >
        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </button>

      <main className="mx-auto flex min-h-screen w-full max-w-[1600px] items-center px-8 pb-16 pt-28 sm:px-14 lg:px-24">
        <div className="w-full">
          <Slide slide={slide} index={active} total={slides.length} deck={deck.content} />
        </div>
      </main>

      <button
        type="button"
        onClick={() => go(active - 1)}
        disabled={active === 0}
        className="fixed left-3 top-1/2 z-40 -translate-y-1/2 rounded-full border border-white/15 bg-[#070d23]/70 p-3 text-white/75 backdrop-blur transition hover:bg-white/10 disabled:opacity-0 sm:left-8"
        aria-label="Previous slide"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => go(active + 1)}
        disabled={active === slides.length - 1}
        className="fixed right-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-white p-3 text-[#17103b] shadow-lg transition hover:bg-white/85 disabled:opacity-0 sm:right-8"
        aria-label="Next slide"
      >
        <ArrowRight className="h-5 w-5" />
      </button>

      {menuOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070d23]/98 p-6 sm:p-12">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a895ff]">
                  Slide overview
                </p>
                <h2 className="mt-2 text-3xl font-extrabold">STI Electrical — Phase 2</h2>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-full border border-white/15 p-3"
                aria-label="Close slide overview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slides.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    go(index);
                    setMenuOpen(false);
                  }}
                  className={`rounded-2xl border p-5 text-left transition ${index === active ? "border-[#a895ff] bg-[#7b4dff]/15" : "border-white/10 bg-white/[.04] hover:bg-white/[.09]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/45">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {index === active ? (
                      <Check className="h-4 w-4 text-[#a895ff]" />
                    ) : (
                      <Circle className="h-3 w-3 text-white/20" />
                    )}
                  </div>
                  <div className="mt-5 text-sm font-bold">{item.title}</div>
                  <div className="mt-2 text-xs text-white/45">{item.eyebrow}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Slide({
  slide,
  index,
  total,
  deck,
}: {
  slide: PitchDeckSlide;
  index: number;
  total: number;
  deck: PitchDeckContent;
}) {
  const colors = ["#a895ff", "#57d8ed", "#f5bd4d", "#ff8e78"];
  const accent = colors[index % colors.length];
  return (
    <section className="animate-in fade-in slide-in-from-bottom-3 duration-500" key={slide.id}>
      <div className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: accent }}>
          {slide.eyebrow}
        </p>
        <h1 className="mt-5 max-w-5xl text-4xl font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65 sm:text-xl">
            {slide.subtitle}
          </p>
        )}
        {slide.body && (
          <p className="mt-7 max-w-4xl whitespace-pre-line text-base leading-8 text-white/70 sm:text-lg">
            {slide.body}
          </p>
        )}
      </div>
      {slide.metrics && (
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {slide.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-white/10 bg-white/[.06] p-6"
            >
              <div
                className="text-3xl font-extrabold tracking-tight sm:text-4xl"
                style={{ color: accent }}
              >
                {metric.value}
              </div>
              <div className="mt-2 text-sm leading-5 text-white/55">{metric.label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-7 flex max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-3">
        <Volume2 className="h-4 w-4 shrink-0 text-[#a895ff]" />
        {slide.audioUrl ? (
          <>
            <button
              type="button"
              className="rounded-full bg-[#a895ff] px-4 py-2 text-sm font-bold text-[#070d23] transition hover:bg-white"
              onClick={() => {
                if (!audioRef.current) return;
                if (isPlaying) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                } else {
                  void audioRef.current.play();
                  setIsPlaying(true);
                }
              }}
            >
              {isPlaying ? "Pause overview" : "Listen to overview"}
            </button>
            <audio
              ref={audioRef}
              className="h-9 min-w-0 flex-1"
              controls
              preload="none"
              src={slide.audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              aria-label={`Listen to slide ${index + 1}`}
            />
          </>
        ) : (
          <span className="text-sm text-white/45">
            Voiceover coming soon — the overview will be read aloud here.
          </span>
        )}
      </div>
      {slide.bullets && (
        <div className="mt-10 grid max-w-4xl gap-4">
          {slide.bullets.map((bullet) => (
            <div key={bullet} className="flex gap-4 text-base leading-7 text-white/75 sm:text-lg">
              <div
                className="mt-2 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {bullet}
            </div>
          ))}
        </div>
      )}
      {slide.columns && (
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slide.columns.map((column) => (
            <article
              key={column.title}
              className="rounded-2xl border border-white/10 bg-white/[.055] p-6"
            >
              <h2
                className="text-xl font-bold"
                style={{
                  color:
                    column.accent === "cyan"
                      ? "#57d8ed"
                      : column.accent === "amber"
                        ? "#f5bd4d"
                        : column.accent === "violet"
                          ? "#a895ff"
                          : "#fff",
                }}
              >
                {column.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/65">{column.body}</p>
              {column.bullets && (
                <ul className="mt-5 space-y-2 text-sm leading-5 text-white/55">
                  {column.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="text-white/40">·</span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
      {slide.gantt && (
        <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[minmax(190px,1fr)_repeat(8,1fr)] gap-2 border-b border-white/10 pb-3 text-center text-[10px] font-bold uppercase tracking-widest text-white/35">
              <div className="text-left">Workstream</div>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
                <div key={week}>W{week}</div>
              ))}
            </div>
            {slide.gantt.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(190px,1fr)_repeat(8,1fr)] gap-2 border-b border-white/6 py-4 last:border-0"
              >
                <div>
                  <div className="text-sm font-semibold">{row.label}</div>
                  <div className="mt-1 max-w-[250px] text-xs leading-4 text-white/40">
                    {row.detail}
                  </div>
                </div>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
                  <div key={week} className="flex items-start justify-center">
                    {week >= row.weeks[0] && week <= row.weeks[1] ? (
                      <div className="h-7 w-full rounded-md bg-gradient-to-r from-[#7b4dff] to-[#4cc9f0]" />
                    ) : (
                      <div className="h-7 w-full rounded-md bg-white/[.025]" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {slide.links && (
        <div className="mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {slide.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group rounded-2xl border border-white/15 bg-white/[.06] p-5 transition hover:-translate-y-1 hover:border-[#a895ff] hover:bg-white/[.1]"
            >
              <div className="flex items-center justify-between gap-3 text-base font-bold text-white">
                <span>{link.label}</span>
                <ArrowRight className="h-4 w-4 text-[#a895ff] transition group-hover:translate-x-1" />
              </div>
              {link.description && (
                <p className="mt-2 text-sm leading-6 text-white/55">{link.description}</p>
              )}
            </a>
          ))}
        </div>
      )}
      <div className="mt-12 flex items-center gap-3 text-xs text-white/35">
        <span>{deck.preparedBy}</span>
        <span>·</span>
        <span>{deck.date}</span>
        {index === total - 1 && <ExternalLink className="ml-1 h-3 w-3" />}
      </div>
    </section>
  );
}
