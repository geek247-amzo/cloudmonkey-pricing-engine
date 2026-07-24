import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Eye,
  Globe2,
  Handshake,
  HeartHandshake,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";

import logo from "@/assets/cm-logo.png";
import amrishPortrait from "@/assets/team/amrish-seunarain.webp";
import sisandaPortrait from "@/assets/team/sisanda-tezapi.webp";
import tebogoPortrait from "@/assets/team/tebogo-matlou.webp";
import { canonicalLink, ogUrl } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CloudMonkey - Our mission, values, and team" },
      {
        name: "description",
        content:
          "Meet the CloudMonkey team and learn how our mission, vision, and values guide the cloud, business, build, voice, and AI services we deliver across Africa.",
      },
      { property: "og:title", content: "About CloudMonkey" },
      {
        property: "og:description",
        content:
          "Cloud technology made simpler, more accountable, and more useful for African businesses.",
      },
      ogUrl("/about"),
    ],
    links: [canonicalLink("/about")],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: Lightbulb,
    title: "Practical innovation",
    description:
      "We use cloud and AI to solve real operating problems, not to add complexity or chase trends.",
  },
  {
    icon: ShieldCheck,
    title: "Accountability",
    description:
      "Clear ownership, measurable service limits, transparent pricing, and honest communication shape every engagement.",
  },
  {
    icon: HeartHandshake,
    title: "Human support",
    description:
      "Technology should never remove the relationship. Clients get a team that listens, explains, and follows through.",
  },
  {
    icon: Handshake,
    title: "Long-term partnership",
    description:
      "We build for the next stage of the business, with infrastructure and systems that can grow without constant replacement.",
  },
  {
    icon: CheckCircle2,
    title: "Simplicity with substance",
    description:
      "One platform and one support team, backed by disciplined engineering, security, monitoring, and commercial clarity.",
  },
] as const;

const TEAM = [
  {
    name: "Amrish Seunarain",
    role: "Head Geek",
    initials: "AS",
    location: "South Africa",
    accent: "#5d2fe8",
    image: amrishPortrait,
    description:
      "Leads CloudMonkey's technology direction, platform architecture, product strategy, and the practical application of cloud and AI.",
  },
  {
    name: "Sisanda Tezapi",
    role: "Operations Overlord",
    initials: "ST",
    location: "South Africa",
    accent: "#0f9f5f",
    image: sisandaPortrait,
    description:
      "Keeps delivery, administration, client onboarding, and day-to-day operations moving with structure and accountability.",
  },
  {
    name: "Tebogo Matlou",
    role: "Key Account Manager",
    initials: "TM",
    location: "South Africa",
    accent: "#1689c7",
    image: tebogoPortrait,
    description:
      "Supports key accounts in South Africa, connecting client priorities with the right CloudMonkey services and delivery teams.",
  },
] as const;

const REGIONAL_PRESENCE = [
  "Namibia",
  "Botswana",
  "Nigeria",
  "Mozambique",
  "Kenya",
] as const;

function AboutPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#07102c] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_20%,rgba(18,183,214,.28),transparent_28%),radial-gradient(circle_at_18%_0%,rgba(109,52,247,.55),transparent_34%),linear-gradient(135deg,#07102c_0%,#121b43_58%,#251256_100%)]" />
        <div className="absolute -right-20 top-20 -z-10 h-96 w-96 rounded-full border border-white/10 shadow-[inset_0_0_0_48px_rgba(255,255,255,.025)]" />
        <div className="mx-auto grid min-h-[610px] max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[.16em] text-white/80">
              <Users className="h-4 w-4" /> About CloudMonkey
            </div>
            <h1
              className="mt-8 max-w-4xl text-[clamp(3.4rem,7vw,6.5rem)] font-extrabold leading-[.9] tracking-[-.06em]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Serious technology.
              <br />
              <span className="text-[#55d4e9]">Less monkey business.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/72">
              CloudMonkey brings cloud infrastructure, managed business technology, websites and
              applications, communications, and AI into one accountable service platform built for
              growing African businesses.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-8 rounded-[3rem] bg-[#5d2fe8]/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
              <img
                src={logo}
                alt="CloudMonkey logo"
                className="h-20 w-20 rounded-3xl bg-white p-2"
              />
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[.18em] text-[#55d4e9]">
                Our promise
              </p>
              <p className="mt-3 text-2xl font-bold leading-snug">
                One platform. One invoice. One team that takes responsibility.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3 text-sm font-semibold text-white/75">
                <span className="rounded-xl bg-white/8 p-3">Cloud</span>
                <span className="rounded-xl bg-white/8 p-3">Build</span>
                <span className="rounded-xl bg-white/8 p-3">Business IT</span>
                <span className="rounded-xl bg-white/8 p-3">AI & Voice</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[.16em] text-[var(--ai)]">
              Why we exist
            </p>
            <h2
              className="mt-4 text-4xl font-extrabold leading-tight tracking-[-.04em] text-[#07102c] md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Technology should move the business forward.
            </h2>
          </div>
          <div className="space-y-6 text-lg leading-8 text-[#4c566f]">
            <p>
              Too many businesses are forced to coordinate separate hosting companies, developers,
              IT providers, communications vendors, and AI tools. The result is fragmented support,
              unclear ownership, duplicated costs, and systems that do not work together.
            </p>
            <p>
              CloudMonkey replaces that fragmentation with a managed platform and a
              multidisciplinary team. We help clients build, operate, secure, and improve their
              digital systems while keeping scope, usage, support, and commercial responsibilities
              visible.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f3f5fa] py-24">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[2rem] bg-white p-9 shadow-[0_20px_60px_rgba(7,16,44,.08)] md:p-12">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-[#eee9ff]" />
            <Compass className="relative h-10 w-10 text-[var(--ai)]" />
            <p className="relative mt-8 text-sm font-extrabold uppercase tracking-[.16em] text-[var(--ai)]">
              Our mission
            </p>
            <h2 className="relative mt-4 text-3xl font-extrabold tracking-[-.035em] text-[#07102c]">
              Make powerful technology simpler to adopt, operate, and afford.
            </h2>
            <p className="relative mt-5 leading-7 text-[#566078]">
              We combine infrastructure, software delivery, managed operations, communications, and
              AI so growing businesses can focus on customers and outcomes instead of managing
              disconnected suppliers.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] bg-[#07102c] p-9 text-white shadow-[0_20px_60px_rgba(7,16,44,.18)] md:p-12">
            <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-white/10" />
            <Eye className="relative h-10 w-10 text-[#55d4e9]" />
            <p className="relative mt-8 text-sm font-extrabold uppercase tracking-[.16em] text-[#55d4e9]">
              Our vision
            </p>
            <h2 className="relative mt-4 text-3xl font-extrabold tracking-[-.035em]">
              An Africa where every ambitious business can access dependable digital capability.
            </h2>
            <p className="relative mt-5 leading-7 text-white/68">
              We want cloud, automation, secure business systems, and AI to become practical growth
              infrastructure for organisations of every size, supported by people who understand
              their markets.
            </p>
          </article>
        </div>
      </section>

      <section id="values" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[.16em] text-[var(--business)]">
              How we work
            </p>
            <h2
              className="mt-4 text-4xl font-extrabold tracking-[-.04em] text-[#07102c] md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Values that show up in the service.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {VALUES.map((value, index) => {
              const Icon = value.icon;
              return (
                <article
                  key={value.title}
                  className="group rounded-3xl border border-[#dfe4ef] bg-white p-6 transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#efeaff] text-[var(--ai)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-xs font-extrabold text-[#b0b7c7]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-7 text-lg font-extrabold text-[#07102c]">{value.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#626c82]">{value.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="team" className="scroll-mt-24 overflow-hidden bg-[#07102c] py-24 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-extrabold uppercase tracking-[.16em] text-[#55d4e9]">
                The humans behind the platform
              </p>
              <h2
                className="mt-4 text-4xl font-extrabold tracking-[-.04em] md:text-5xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Meet the CloudMonkey team.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/58">
              Technology, operations, and key-account leadership based in South Africa and working
              across the continent.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {TEAM.map((member) => (
              <article
                key={member.name}
                className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[.06] p-4 backdrop-blur"
              >
                <div
                  className="absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-20 blur-2xl"
                  style={{ background: member.accent }}
                />
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.35rem] bg-white/[.05]">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={`${member.name}, ${member.role} at CloudMonkey`}
                      className="h-full w-full object-cover object-top transition-transform duration-500 hover:scale-[1.025]"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.14),transparent_30%)] text-5xl font-black text-white"
                      style={{ backgroundColor: `${member.accent}22` }}
                    >
                      <span
                        className="flex h-24 w-24 items-center justify-center rounded-[2rem] shadow-2xl"
                        style={{ background: member.accent }}
                      >
                        {member.initials}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-3 pb-3">
                  <h3 className="relative mt-7 text-xl font-extrabold">{member.name}</h3>
                  <p className="relative mt-2 font-bold" style={{ color: member.accent }}>
                    {member.role}
                  </p>
                  <div className="relative mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-white/45">
                    <MapPin className="h-3.5 w-3.5" /> {member.location}
                  </div>
                  <p className="relative mt-6 text-sm leading-6 text-white/62">
                    {member.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="relative mt-10 overflow-hidden rounded-[1.75rem] border border-white/12 bg-white/[.06] p-7 md:p-9">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#55d4e9]/15 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#55d4e9]/12 text-[#55d4e9]">
                  <Globe2 className="h-6 w-6" />
                </div>
                <p className="mt-6 text-xs font-extrabold uppercase tracking-[.18em] text-[#55d4e9]">
                  The troop is growing
                </p>
                <h3 className="mt-3 text-2xl font-extrabold tracking-[-.03em] md:text-3xl">
                  Already on the ground. Coming to this page soon.
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
                  CloudMonkey people are already building relationships in these markets. Their
                  introductions are next, and their profiles will join the website soon.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {REGIONAL_PRESENCE.map((country, index) => (
                  <div
                    key={country}
                    className={`flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-[#0c1739] p-4 ${
                      index === REGIONAL_PRESENCE.length - 1 ? "col-span-2 sm:col-span-1" : ""
                    }`}
                  >
                    <MapPin className="h-4 w-4 text-[#55d4e9]" />
                    <span className="text-sm font-extrabold">{country}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[linear-gradient(135deg,#efeaff_0%,#f7f9ff_55%,#e5f9fc_100%)] p-9 md:flex-row md:items-center md:p-14">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[.16em] text-[var(--ai)]">
              Build with us
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-[-.035em] text-[#07102c] md:text-4xl">
              Bring the next stage of your business into one managed platform.
            </h2>
          </div>
          <Link
            to="/pricing"
            className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--ai)] px-7 text-sm font-extrabold text-white shadow-lg transition-transform hover:-translate-y-0.5"
          >
            Explore our services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
