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
  ["08", "Still Becoming", "A celebration of fifty years—and every unwritten page still ahead."],
  ["09", "The rest is yours to write", "The chapter Sandi continues herself, in her own words and photographs." ]
];

const requests = [
  "Baby and childhood photographs",
  "Roslyn school pictures and home movies",
  "Boston University and England memories",
  "Family holidays, trips, and funny candids",
  "Oracle photographs, awards, and stories",
  "Letters, cards, drawings, and keepsakes",
  "A 30–120 second personal message or voice note"
];

export default function Home() {
  return (
    <main>
      <Navigation />
      <OpeningExperience />

      <section id="invitation" className="section invitationSection">
        <div className="shell invitationGrid">
          <div className="sectionTitle">
            <span className="eyebrow">THE ARCHIVE IS STILL GROWING</span>
            <h2>Bring another piece of her story into the light.</h2>
            <p>
              The birthday reveal has happened, but the archive stays open. One forgotten photograph, one voice note, or one small page from Sandi can still change the shape of the whole story.
            </p>
            <div className="actions leftActions">
              <Link className="primary" href="/contribute">Add to the archive</Link>
              <Link className="secondary" href="/chapter-nine">Open Chapter Nine</Link>
            </div>
          </div>
          <div className="memoryRequestCard">
            <span className="requestLabel">There is still room for</span>
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
              “Some lives are seen in photographs. Yours is seen in the people who smile when they say your name.”
            </blockquote>
            <cite>Original text written for Sandi</cite>
          </div>
        </div>
      </section>

      <section id="chapters" className="section chapterSection">
        <div className="shell">
          <div className="sectionTitle wideTitle">
            <span className="eyebrow">THE STORY NOW HOLDS NINE ROOMS</span>
            <h2>Eight chapters gathered for her. One chapter she keeps writing.</h2>
            <p>The site still preserves new contributions, and Chapter Nine now belongs to Sandi herself.</p>
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
          <span className="eyebrow">ONE MEMORY IS STILL ENOUGH</span>
          <h2>The story did not stop on August 11.</h2>
          <p>Send what you have, tell her what still matters, or let Sandi write the next page herself.</p>
          <div className="actions">
            <Link className="primary" href="/contribute">Share a memory for Sandi</Link>
            <Link className="secondary" href="/chapter-nine">Enter Chapter Nine</Link>
          </div>
        </div>
      </section>

      <footer><div className="shell footerInner"><span>Created with love by the people whose lives she continues to change.</span><span>The archive remains open · uploads@sandi50th.com</span></div></footer>
    </main>
  );
}
