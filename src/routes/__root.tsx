import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Receipt } from "@/components/landing/Receipt";
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
        href: "https://fonts.googleapis.com/css2?family=Young+Serif&family=Fragment+Mono&family=Inter+Tight:wght@400;500;600&display=swap",
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
    <main className="grid min-h-screen place-items-center bg-bg px-6 py-16">
      <div className="w-full max-w-[340px]">
        <h1 className="sr-only">Page not found</h1>
        <Receipt
          printing
          title="ASKBASE · VOID"
          question="SELECT * FROM pages WHERE url = this one"
          lines={[]}
          footer={[
            ["rows returned", "0"],
            ["status", "404"],
          ]}
        >
          <p className="my-4 text-center text-[2.6em] font-semibold tracking-[0.25em] text-[#d92d20]">
            VOID
          </p>
          <p className="text-center uppercase leading-snug">
            That page doesn't exist. The query came back empty.
          </p>
        </Receipt>
        <Link
          to="/"
          className="mx-auto mt-8 block w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
