import type { Metadata, Viewport } from "next";
import { ParticleTextEffect } from "@/components/ui/particle-text-effect";
import { GlobalMusicMuteButton } from "@/components/GlobalMusicMuteButton";
import { GlobalSiteSearch } from "@/components/GlobalSiteSearch";
import { isRevealPublic } from "@/lib/reveal-visibility";
import "./globals.css";
import "./global-music-mute.css";
import "./celebration-pass.css";
import "./saturated-celebration.css";
import "./high-energy-celebration.css";
import "./global-search.css";
import "./review-mode.css";
import "./rehearsal-runtime.css";
import "./hero-asset.css";
import "./approved-pink-champagne.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const publicReveal = await isRevealPublic();
  return {
    title: "Still Becoming \u2014 The Story of Sandi",
    description: "A 50th-birthday documentary created by the people who love Sandi.",
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
  return <html lang="en"><body>{children}<GlobalSiteSearch /><GlobalMusicMuteButton /><ParticleTextEffect /></body></html>;
}
