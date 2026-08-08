import type { Metadata } from "next";
import { StudioPasswordReset } from "@/components/StudioPasswordReset";

export const metadata: Metadata = {
  title: "Set Story Studio password",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true }
};

export default function StudioPasswordResetPage() {
  return <main className="storyStudioPage"><div className="shell"><StudioPasswordReset /></div></main>;
}
