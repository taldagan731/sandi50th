import type { Metadata } from "next";
import { StoryStudio } from "@/components/StoryStudio";
import "./studio-intelligence.css";
import "./studio-live-feed.css";
import "./media-deletion.css";
import "./family-qa.css";
import "./name-chorus-studio.css";
import "./mobile-studio.css";
import "./media-organizer.css";
import "./face-tags.css";


export const metadata: Metadata = {
  title: "Private Story Studio",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true }
};

export default function StudioPage() {
  return (
    <main className="storyStudioPage">
      <div className="shell">
        <StoryStudio />
      </div>
    </main>
  );
}
