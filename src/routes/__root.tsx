import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";

const TITLE = "Askbase — ask your business data anything";
const DESCRIPTION =
  "Drop in your Stripe, Shopify or spreadsheet exports, ask in plain English, and get the answer with the SQL that proves it. Your rows never leave your browser.";

// Runs before paint so the stored theme never flashes.
const THEME_SCRIPT = `try{if(localStorage.getItem("askbase.theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "author", content: "Lisanegebriel Abay" },
      { name: "theme-color", content: "#f6f5f0" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Askbase" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Fragment+Mono&family=Inter+Tight:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [{ children: THEME_SCRIPT }],
  }),
  shellComponent: Shell,
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 text-center">
      <div>
        <p className="eyebrow">404 · no rows returned</p>
        <h1 className="display mt-4 text-6xl font-semibold">
          <span className="mark">SELECT</span> * FROM pages
          <br />
          WHERE url = this
        </h1>
        <p className="mt-4 text-muted">That page doesn't exist — the query came back empty.</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
