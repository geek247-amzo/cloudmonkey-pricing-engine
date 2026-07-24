import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CurrencyProvider } from "../lib/currency";
import { Header } from "../components/site/Header";
import { Footer } from "../components/site/Footer";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { GlobalChat } from "../components/GlobalChat";
import logo from "../assets/cm-logo.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CloudMonkey — Cloud, Business & AI in one platform" },
      { name: "description", content: "CloudMonkey brings together cloud infrastructure, managed IT, and AI agents in one platform with a single invoice and dashboard." },
      { name: "author", content: "CloudMonkey" },
      { property: "og:title", content: "CloudMonkey — One platform for cloud, business & AI" },
      { property: "og:description", content: "Cloud, managed IT and AI agents in one platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@CloudMonkey" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: logo },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://cloudmonkey.co.za/#organization",
        name: "CloudMonkey",
        url: "https://cloudmonkey.co.za",
        description:
          "A South African managed cloud, website, business technology, voice, and AI services company.",
        areaServed: [
          { "@type": "Country", name: "South Africa" },
          { "@type": "Country", name: "Kenya" },
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://cloudmonkey.co.za/#website",
        url: "https://cloudmonkey.co.za",
        name: "CloudMonkey",
        publisher: { "@id": "https://cloudmonkey.co.za/#organization" },
        inLanguage: "en-ZA",
      },
    ],
  };

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAppRoute = pathname.startsWith("/auth") || isDashboardRoute;

  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        {isDashboardRoute ? (
          <DashboardShell>
            <Outlet />
          </DashboardShell>
        ) : (
          <div className="flex min-h-screen flex-col bg-background">
            {!isAppRoute && <Header />}
            <main className="flex-1">
              <Outlet />
            </main>
            {!isAppRoute && <Footer />}
          </div>
        )}
        <GlobalChat />
      </CurrencyProvider>
    </QueryClientProvider>
  );
}
