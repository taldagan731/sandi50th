import Link from "next/link";
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

export default function Home() {
  return (
    <main>
      <Navigation />
      <OpeningExperience />

      <section id="invitation" className="section invitationSection">
        <div className="shell invitationGrid">
          <div className="sectionTitle">
            <span className="eyebrow">HELP US RECOVER THE DETAILS</span>
            <h2>Bring a piece of her life back to her.</h2>
            <p>
              Search old albums, phones, family group chats, cloud libraries, tapes, and boxes of keepsakes. One forgotten photograph can unlock an entire story.
            </p>
            <Link className="primary" href="/contribute">Add your chapter</Link>
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
            <span className="eyebrow">THE LITERARY HEART</span>
            <blockquote>
              “Some lives are remembered in photographs. Yours is remembered in the people who still smile when they say your name.”
            </blockquote>
            <cite>Original text written for Sandi</cite>
          </div>
        </div>
      </section>

      <section id="chapters" className="section chapterSection">
        <div className="shell">
          <div className="sectionTitle wideTitle">
            <span className="eyebrow">THE FILM WE ARE BUILDING</span>
            <h2>Eight rooms. One unfolding story.</h2>
            <p>The public site gathers the pieces. On August 11, those pieces become a private documentary and living archive created only for Sandi.</p>
          </div>
          <div className="chapters">
            {chapters.map(([number, title, copy]) => (
              <article key={number}>
                <span>CHAPTER {number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section closingInvitation">
        <div className="shell closingInner">
          <span className="eyebrow">ONE MEMORY IS ENOUGH</span>
          <h2>Help us make sure her story includes you.</h2>
          <p>Nothing needs to be polished. Speak honestly, send what you have, and tell us why the moment matters.</p>
          <Link className="primary" href="/contribute">Share a memory for Sandi</Link>
        </div>
      </section>

      <footer><div className="shell footerInner"><span>Created with love by the people whose lives she changed.</span><span>Contributions due August 7, 2026 · uploads@sandi50th.com</span></div></footer>
    </main>
  );
}
