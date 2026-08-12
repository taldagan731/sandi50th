import { Navigation } from "@/components/Navigation";
import { ChapterNineRoom } from "@/components/ChapterNineRoom";
import "./chapter-nine-room.css";

export default function ChapterNinePage() {
  return (
    <main>
      <Navigation />
      <section className="chapterNinePageTop">
        <div className="shell">
          <ChapterNineRoom />
        </div>
      </section>
    </main>
  );
}
