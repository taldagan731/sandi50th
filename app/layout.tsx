import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./celebration-pass.css";
import "./saturated-celebration.css";
import "./high-energy-celebration.css";
import "./review-mode.css";
import "./rehearsal-runtime.css";

export const metadata: Metadata = {
  title: "Still Becoming — The Story of Sandi",
  description: "A private 50th-birthday documentary created by the people who love Sandi.",
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
