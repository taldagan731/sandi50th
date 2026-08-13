import type { Metadata, Viewport } from "next";
import { isRevealPublic } from "@/lib/reveal-visibility";
import { SiteChrome } from "@/components/SiteChrome";
import "./globals.css";
import "./celebration-pass.css";
import "./saturated-celebration.css";
import "./high-energy-celebration.css";
import "./review-mode.css";
import "./rehearsal-runtime.css";
import "./hero-asset.css";
import "./approved-pink-champagne.css";
import "./global-search.css";
import "./global-search-dedup.css";
import "./global-mute.css";
import "./global-help.css";
import "./site-credits.css";
import "./launch-accessibility-fixes.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  let publicReveal = false;
  try { publicReveal = await isRevealPublic(); } catch { /* Local visual previews do not carry production credentials. */ }
  return {
    metadataBase: new URL("https://www.sandi50th.com"),
    title: "Still Becoming \u2014 The Story of Sandi",
    description: "A 50th-birthday documentary created by the people who love Sandi.",
    openGraph: {
      title: "Still Becoming \u2014 The Story of Sandi",
      description: "A 50th-birthday documentary created by the people who love Sandi.",
      url: "https://www.sandi50th.com/reveal",
      siteName: "Still Becoming",
      type: "website",
      images: [{ url: "/images/sandi50th-social.jpg", width: 1200, height: 630, alt: "Still Becoming \u2014 The Story of Sandi" }]
    },
    twitter: {
      card: "summary_large_image",
      title: "Still Becoming \u2014 The Story of Sandi",
      description: "A 50th-birthday documentary created by the people who love Sandi.",
      images: ["/images/sandi50th-social.jpg"]
    },
    icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
    robots: publicReveal ? { index: true, follow: true } : { index: false, follow: false }
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<SiteChrome /></body></html>;
}


