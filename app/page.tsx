import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Countdown } from "@/components/Countdown";

const chapters = [
  ["01","Once Upon a Time","Born at LIJ in New Hyde Park and surrounded by family."],
  ["02","Growing Up in Roslyn","Childhood, school days, family traditions, and Beth."],
  ["03","Finding Her Voice","Boston University, English and psychology, and England."],
  ["04","Building Something Bigger","Magazine advertising, Oracle, leadership, and global impact."],
  ["05","The Family She Chose","Love, partnership, Bram, Josephine, and becoming a stepmother."],
  ["06","Around the World","Iceland, Spain, England, France, Italy, Puerto Rico, and Israel."],
  ["07","The People Who Love Her","Parents, siblings, cousins, friends, and colleagues."],
  ["08","Still Becoming","Fifty years lived—and every unwritten chapter ahead."]
];

export default function Home() {
  return <main><Navigation/>
    <section className="hero"><div className="aurora"/><div className="stars"/>
      <div className="heroContent"><div className="eyebrow">A PRIVATE CELEBRATION · AUGUST 11, 2026</div>
        <h1>Every life leaves a <em>constellation.</em></h1>
        <p>We are gathering photographs, home movies, voices, and fragments of fifty remarkable years to create one unforgettable film for Sandi.</p>
        <div className="actions"><Link className="primary" href="/contribute">Help tell her story</Link><a className="secondary" href="#chapters">Enter the exhibition</a></div>
        <Countdown/>
      </div>
      <div className="headlines"><div>Roslyn remembers a girl with a love of words · Boston opens another chapter · Across the Atlantic: a semester in England · Magazine advertising gives way to global leadership · Love creates a family · </div></div>
    </section>
    <section className="section"><div className="shell"><div className="sectionTitle"><span className="eyebrow">THE LITERARY HEART</span><h2>A life told as beautifully as it was lived.</h2></div>
      <blockquote>“Some lives are remembered in photographs. Yours is remembered in the people who still smile when they say your name.”<cite>Original text for Sandi</cite></blockquote>
    </div></section>
    <section id="chapters" className="section"><div className="shell"><div className="sectionTitle"><span className="eyebrow">THE DOCUMENTARY ARC</span><h2>Eight rooms. One unfolding story.</h2></div>
      <div className="chapters">{chapters.map(c => <article key={c[0]}><span>CHAPTER {c[0]}</span><h3>{c[1]}</h3><p>{c[2]}</p></article>)}</div>
    </div></section>
    <footer><div className="shell">Still Becoming · uploads@sandi50th.com · Contributions due August 7, 2026</div></footer>
  </main>;
}
