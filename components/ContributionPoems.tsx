import styles from "./ContributionPoems.module.css";

type Poem = {
  title: string;
  lines: Array<string | { text: string; source: string }>;
  contributors: string;
};

const CHAPTER_POEMS: Partial<Record<number, Poem>> = {
  1: {
    title: "The Small Kingdom",
    lines: [
      "Before anyone knew what fifty would look like,",
      "there were Barbie shoes,",
      "honeysuckle for lunch,",
      "goldfish no one could see,",
      "lemonade at the first small counter,",
      "and two girls with rocks",
      "inventing recess."
    ],
    contributors: "Dalia"
  },
  2: {
    title: "Roslyn Instructions",
    lines: [
      { text: "At the lockers, you stood up for me.", source: "Beth" },
      "An Il Bisonte bag changed hands.",
      "Two driveways held a two-day goodbye.",
      "There were Ritz-cracker nachos,",
      "the duck pond, the Port drive,",
      "and a language nobody else could enter.",
      { text: "Okay, but you can’t talk.", source: "Shiry" },
      "Then came a lifetime of talking."
    ],
    contributors: "Beth and Shiry"
  },
  3: {
    title: "The List",
    lines: [
      "A name goes away to college",
      "on a friend’s contact list.",
      "Years pass.",
      "The name stays.",
      "So does the voice that says",
      "go on, take the risk,",
      "I am still here."
    ],
    contributors: "Shiry and Ben"
  },
  5: {
    title: "Another Mother",
    lines: [
      "No announcement.",
      "Just right from wrong,",
      "a comfortable place,",
      "concerns brought into the light,",
      "love given until trust",
      "has somewhere to live.",
      { text: "She is like another mother to them.", source: "Emile" }
    ],
    contributors: "Emile and Jenny"
  },
  6: {
    title: "Departures and Arrivals",
    lines: [
      "Greece, and the fly determined to die hard, and the cab driver bursting into the room, and the hundred-degree walk to dinner;",
      "Israel, and everyone waiting in the car while two sisters went toward the waterfall, until Papa came running up behind them;",
      "Portugal, and the enormous Jesus statue appearing on the road;",
      "New York to Los Angeles and back again, England and France and Italy, Iceland and Spain and Puerto Rico—",
      "the world accumulating not as pins on a map",
      "but as stories that still make the room laugh."
    ],
    contributors: "Jenny, Jenn, and Emile"
  },
  7: {
    title: "What Follows Her",
    lines: [
      "A hug.",
      "A question asked and meant.",
      "A call afterward because she remembered.",
      "A look across the room when the zing lands.",
      "Cookie crumb. Secret nicknames.",
      { text: "Tiramisu, Emmy.", source: "Emile" },
      "And then the plain family truth:",
      { text: "Happiness follows.", source: "Emile" }
    ],
    contributors: "Emile, Jenny, and Ben"
  },
  8: {
    title: "Fifty, Forward",
    lines: [
      "Keep the calm.",
      "Keep the laugh that crosses a crowded room.",
      "Keep the sweetness and the part",
      "that is not one to mess with.",
      "Keep the adventures waiting beyond Tuesday.",
      { text: "Do not change. Keep being your authentic self.", source: "Emile" }
    ],
    contributors: "Emile and Jenny"
  }
};

const FINALE: Poem = {
  title: "What the Family Knows",
  lines: [
    "They know the lockers and the bag switch and the driveways that could not bear two days apart,",
    "the Barbies and honeysuckle and imaginary goldfish, the lemonade stand, the duck pond, the Burger King rule that became a lifetime of conversation,",
    "the Greece hotel on the highway, the fly, the cab driver, the waterfall and Papa running, the strange statue on the road into Portugal,",
    "the pictures of tiramisu crossing the country, the perfect zing delivered by one look, the secret nicknames, the cookie crumb,",
    "the children who trust her with their concerns, the sister she protects, the cousin she cheers forward, the friend whose life is different because they met young,",
    "and they know this too:",
    "when she enters, people move toward her;",
    "when they speak, she listens;",
    "when something is hard, she follows up;",
    "when life moves, she keeps moving with it—",
    "calm, laughing, authentic, loved."
  ],
  contributors: "Dalia, Beth, Shiry, Jenny, Jenn, Emile, Ben, and Zev"
};

function PoemCard({ poem, finale = false }: { poem: Poem; finale?: boolean }) {
  return (
    <aside className={`${styles.poem}${finale ? ` ${styles.finale}` : ""}`} aria-label={`${poem.title}, made from family contributions`}>
      <span className={styles.label}>MADE FROM WHAT YOUR FAMILY WROTE</span>
      <h3>{poem.title}</h3>
      <div className={styles.verse}>
        {poem.lines.map((line, index) => typeof line === "string" ? (
          <p key={index}>{line}</p>
        ) : (
          <p key={index}>{line.text}<small aria-label={`words by ${line.source}`}>— {line.source}</small></p>
        ))}
      </div>
      <p className={styles.credit}>made from words by {poem.contributors}</p>
    </aside>
  );
}

export function ChapterContributionPoem({ chapterNumber }: { chapterNumber: number }) {
  const poem = CHAPTER_POEMS[chapterNumber];
  return poem ? <PoemCard poem={poem} /> : null;
}

export function FamilyFinalePoem() {
  return <PoemCard poem={FINALE} finale />;
}
