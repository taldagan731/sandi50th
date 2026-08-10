import Link from "next/link";
import { redirect } from "next/navigation";
import { isRevealPublic } from "@/lib/reveal-visibility";
import { Navigation } from "@/components/Navigation";
import { OpeningExperience } from "@/components/OpeningExperience";

const chapters = [
  ["01", "Once Upon a Time", "Her birth at LIJ in New Hyde Park, the first photographs, and the family who knew her first."],
  ["02", "Growing Up in Roslyn", "Childhood, school days, family traditions, and a friendship with Beth that began in grade school."],
  ["03", "Finding Her Voice", "Boston University, an English and psychology double major, and a semester abroad in England."],
  ["04", "Building Something Bigger", "Magazine advertising, Oracle, global process ownership, leadership, and work that shaped how people and resources move."],
  ["05", "The Family She Chose", "Love, partnership, and the chapter in which she became a stepmother to Bram and Josephine."],
  ["06", "Around the World", "Iceland, Spain, England, France, Italy, Puerto Rico, Israel, and the memories carried home."],
  ["07", "The People Who Love Her", "Nathan and Fay, Jenny and E, Steven and Debi, cousins, friends, colleagues, and generations of family."],
  ["08", "Still Becoming", "A celebration of fifty years—and every unwritten page still ahead."]
];

const requests = [
  "Baby and childhood photographs",
  "Roslyn school pictures and home movies",
  "Boston University and England memories",
  "Family holidays, trips, and funny candids",
  "Oracle photographs, awards, and stories",
  "Letters, cards, drawings, and keepsakes",
  "A 30–120 second personal birthday message"
];

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await isRevealPublic()) redirect("/reveal");

  return (
    <main>
      <Navigation />
      <OpeningExperience />

      <section id="invitation" className="section invitationSection">
        <div className="shell invitationGrid">
          <div className="sectionTitle">
            <span className="eyebrow">BRING THE ALBUMS OUT</span>
            <h2>Bring your favorite Sandi moment.</h2>
            <p>
              Open the albums, scroll the camera roll, and ask the family group chat. Send the photographs and stories that make you laugh, make you call someone, or could only belong to Sandi.
            </p>
            <div className="actions leftActions"><Link className="primary" href="/contribute?mode=birthday#active-contribution-form">Record a birthday message</Link><Link className="secondary" href="/contribute">Share photos or a memory</Link></div>
          </div>
          <div className="memoryRequestCard">
            <span className="requestLabel">We are looking for</span>
            <ul>{requests.map(item => <li key={item}>{item}</li>)}</ul>
            <p>Questions or upload trouble? <a href="mailto:uploads@sandi50th.com">uploads@sandi50th.com</a></p>
          </div>
        </div>
      </section>

      <section className="section literarySection">
        <div className="shell">
          <div className="literaryCard">
            <span className="eyebrow">WHAT EVERYONE KNOWS</span>
            <blockquote>
              “You make a room warmer, a story better, and the people around you more fully themselves.”
            </blockquote>
            <cite>For Sandi, on her fiftieth</cite>
          </div>
        </div>
      </section>

      <section id="chapters" className="section chapterSection">
        <div className="shell">
          <div className="sectionTitle wideTitle">
            <span className="eyebrow">THE BIRTHDAY STORY</span>
            <h2>Eight rooms. One unfolding story.</h2>
            <p>Every room holds a different side of Sandi. On August 11, photographs, voices, and stories come together in one birthday film made by the people who know her.</p>
          </div>
          <div className="chapters">
            {chapters.map(([number, title, copy]) => (
              <Link
                className="chapterRoom"
                href={`/contribute?chapter=${Number(number)}#contribution-memory`}
                key={number}
              >
                <span>CHAPTER {number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <strong>Share something for this room →</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section closingInvitation">
        <div className="shell closingInner">
          <span className="eyebrow">ONE MEMORY IS ENOUGH</span>
          <h2>Come celebrate her with us.</h2>
          <p>Nothing needs to be polished. Send the photograph that makes you grin, tell the story only you know, or speak to her as if she were right in front of you.</p>
          <div className="actions"><Link className="primary" href="/contribute?mode=birthday#active-contribution-form">Record a birthday message</Link><Link className="secondary" href="/contribute">Share something else</Link></div>
          <p className="continuingContributions">Contributions welcomed before and after August 11 · uploads@sandi50th.com</p>
        </div>
      </section>
    </main>
  );
}
