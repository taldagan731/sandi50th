"use client";

import { useEffect, useState } from "react";

const whispers = [
  "Born in New Hyde Park",
  "Raised in Roslyn",
  "A lifelong love of books",
  "Boston University",
  "A semester in England",
  "Magazine advertising",
  "Global leadership at Oracle",
  "Iceland · Spain · France · Italy · Israel",
  "A daughter · a sister · a friend · a stepmother",
];

const chapters = [
  {
    number: "I",
    title: "Origins",
    text: "New Hyde Park, Roslyn, family, childhood, and the first stories.",
  },
  {
    number: "II",
    title: "Discovery",
    text: "Boston University, English, psychology, and a semester abroad.",
  },
  {
    number: "III",
    title: "Purpose",
    text: "From magazine advertising to shaping global systems at Oracle.",
  },
  {
    number: "IV",
    title: "Love",
    text: "Family, friendship, partnership, and the lives she helped change.",
  },
];

export default function HomePage() {
  const [entered, setEntered] = useState(false);
  const [countdown, setCountdown] = useState({
    days: "--",
    hours: "--",
    minutes: "--",
    seconds: "--",
  });

  useEffect(() => {
    const target = new Date("2026-08-11T00:00:00-04:00").getTime();

    const update = () => {
      const difference = Math.max(0, target - Date.now());

      setCountdown({
        days: String(Math.floor(difference / 86400000)),
        hours: String(Math.floor(difference / 3600000) % 24).padStart(2, "0"),
        minutes: String(Math.floor(difference / 60000) % 60).padStart(2, "0"),
        seconds: String(Math.floor(difference / 1000) % 60).padStart(2, "0"),
      });
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <main className="aurora-page">
        {!entered ? (
          <section className="cover">
            <div className="aurora" />
            <div className="stars" />

            <div className="cover-inner">
              <p className="overline">A PRIVATE CELEBRATION · AUGUST 11, 2026</p>

              <h1>
                The way we
                <br />
                <em>remember you.</em>
              </h1>

              <p className="intro">
                For fifty years, Sandi has been writing a story without ever
                realizing how many people became part of it.
              </p>

              <button className="primary-button" onClick={() => setEntered(true)}>
                Open the story
              </button>

              <a className="quiet-link" href="/contribute">
                I came to share a memory
              </a>
            </div>

            <div className="whisper-line" aria-hidden="true">
              <div className="whisper-track">
                {[...whispers, ...whispers].map((item, index) => (
                  <span key={`${item}-${index}`}>{item}</span>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <div className="story-shell">
            <header className="minimal-header">
              <button className="brand" onClick={() => setEntered(false)}>
                <span className="brand-mark">S</span>
                <span>
                  <strong>The Story of Sandi</strong>
                  <small>Still Becoming</small>
                </span>
              </button>

              <a href="/contribute" className="header-link">
                Share a memory
              </a>
            </header>

            <section className="hero">
              <div className="aurora" />
              <div className="stars" />

              <div className="hero-copy">
                <p className="overline">THE FIRST FIFTY YEARS</p>

                <h2>
                  Every life leaves
                  <br />
                  a <em>constellation.</em>
                </h2>

                <p>
                  We are gathering photographs, home movies, stories, voices,
                  letters, and moments from the people who know and love Sandi.
                </p>

                <div className="hero-actions">
                  <a className="primary-button" href="/contribute">
                    Help tell her story
                  </a>
                  <a className="secondary-button" href="#chapters">
                    Turn the page
                  </a>
                </div>
              </div>

              <div className="countdown" aria-label="Countdown to Sandi's birthday">
                {Object.entries(countdown).map(([label, value]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="literary-section">
              <div className="section-wrap">
                <p className="overline">A DIGITAL LOVE LETTER</p>

                <blockquote>
                  “Some lives are remembered in photographs. Yours is remembered
                  in the people who still smile when they say your name.”
                </blockquote>

                <p className="attribution">Original words for Sandi</p>
              </div>
            </section>

            <section id="chapters" className="chapters-section">
              <div className="section-wrap">
                <div className="section-heading">
                  <p className="overline">THE STORY SO FAR</p>
                  <h3>Four volumes. Countless memories.</h3>
                  <p>
                    The final documentary will be shaped by the memories,
                    photographs, and voices contributed by the people in Sandi’s
                    life.
                  </p>
                </div>

                <div className="chapter-grid">
                  {chapters.map((chapter) => (
                    <article key={chapter.number} className="chapter-card">
                      <span>VOLUME {chapter.number}</span>
                      <h4>{chapter.title}</h4>
                      <p>{chapter.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="contribute-section">
              <div className="section-wrap contribute-grid">
                <div>
                  <p className="overline">PLEASE SUBMIT BY AUGUST 7</p>
                  <h3>Bring back a moment she may have forgotten.</h3>
                  <p>
                    Baby photos, childhood pictures, old home movies, school
                    memories, family holidays, travel photographs, Oracle
                    milestones, voice notes, and personal birthday messages are
                    all welcome.
                  </p>
                </div>

                <div className="contribute-card">
                  <p className="question">
                    When you think of Sandi, what is the first memory that comes
                    to mind?
                  </p>

                  <a className="primary-button full" href="/contribute">
                    Share that memory
                  </a>

                  <p className="support">
                    Need help? uploads@sandi50th.com
                  </p>
                </div>
              </div>
            </section>

            <footer>
              Created with love by the people whose lives you changed.
            </footer>
          </div>
        )}
      </main>

      <style jsx global>{`
        :root {
          --ink: #09080d;
          --ink-soft: #13101a;
          --paper: #fbf7fa;
          --rose: #ef9ac8;
          --orchid: #9c6ade;
          --violet: #6f42c1;
          --lavender: #dcc7f4;
          --mist: #aaa3b1;
          --line: rgba(255, 255, 255, 0.12);
        }

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
          background: var(--ink);
        }

        body {
          margin: 0;
          background: var(--ink);
          color: var(--paper);
          font-family: Inter, Arial, Helvetica, sans-serif;
        }

        button,
        a {
          font: inherit;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        button {
          cursor: pointer;
        }

        .aurora-page {
          min-height: 100vh;
          background: var(--ink);
          overflow: hidden;
        }

        .cover,
        .hero {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
        }

        .cover {
          display: grid;
          place-items: center;
          text-align: center;
          padding: 80px 22px;
        }

        .aurora {
          position: absolute;
          inset: -35%;
          background:
            radial-gradient(circle at 24% 34%, rgba(239, 154, 200, 0.28), transparent 23%),
            radial-gradient(circle at 72% 28%, rgba(156, 106, 222, 0.3), transparent 28%),
            radial-gradient(circle at 54% 72%, rgba(111, 66, 193, 0.21), transparent 25%);
          filter: blur(70px);
          animation: auroraMove 15s ease-in-out infinite alternate;
        }

        .stars {
          position: absolute;
          inset: 0;
          opacity: 0.42;
          background-image:
            radial-gradient(circle, rgba(255,255,255,.72) 0 1px, transparent 1.5px),
            radial-gradient(circle, rgba(239,154,200,.45) 0 1px, transparent 1.7px);
          background-size: 71px 71px, 109px 109px;
          background-position: 12px 18px, 43px 31px;
          mask-image: linear-gradient(to bottom, black, transparent 92%);
        }

        @keyframes auroraMove {
          to {
            transform: translate3d(4%, -3%, 0) scale(1.08);
          }
        }

        .cover-inner,
        .hero-copy,
        .countdown,
        .minimal-header {
          position: relative;
          z-index: 2;
        }

        .cover-inner {
          max-width: 980px;
        }

        .overline {
          margin: 0;
          color: var(--rose);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }

        h1,
        h2,
        h3,
        h4,
        blockquote {
          font-family: Georgia, "Times New Roman", serif;
        }

        h1 {
          margin: 28px 0;
          font-size: clamp(68px, 10vw, 146px);
          font-weight: 500;
          line-height: 0.8;
          letter-spacing: -0.065em;
        }

        h1 em,
        h2 em {
          color: var(--rose);
          font-weight: 500;
        }

        .intro {
          max-width: 710px;
          margin: 0 auto 34px;
          color: #c7bfcc;
          font-size: clamp(17px, 2vw, 23px);
          line-height: 1.65;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 50px;
          padding: 0 23px;
          border-radius: 999px;
          font-weight: 800;
          transition: transform 0.22s ease, filter 0.22s ease;
        }

        .primary-button {
          border: 0;
          background: linear-gradient(135deg, var(--rose), var(--orchid));
          color: #190d21;
          box-shadow: 0 14px 45px rgba(156, 106, 222, 0.24);
        }

        .secondary-button {
          border: 1px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.04);
          color: var(--paper);
        }

        .primary-button:hover,
        .secondary-button:hover {
          transform: translateY(-2px);
          filter: brightness(1.05);
        }

        .quiet-link {
          display: block;
          width: max-content;
          margin: 20px auto 0;
          color: #b7afbd;
          font-size: 13px;
          border-bottom: 1px solid rgba(255,255,255,.18);
          padding-bottom: 3px;
        }

        .whisper-line {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 7%;
          overflow: hidden;
          opacity: 0.25;
          transform: rotate(-2deg);
        }

        .whisper-track {
          display: flex;
          gap: 44px;
          width: max-content;
          animation: whisperMove 50s linear infinite;
        }

        .whisper-track span {
          white-space: nowrap;
          font: italic 20px Georgia, serif;
        }

        @keyframes whisperMove {
          to {
            transform: translateX(-50%);
          }
        }

        .minimal-header {
          position: fixed;
          inset: 0 0 auto;
          height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 5vw;
          z-index: 20;
          background: linear-gradient(to bottom, rgba(9,8,13,.9), transparent);
          backdrop-filter: blur(12px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 0;
          background: transparent;
          color: white;
          text-align: left;
        }

        .brand-mark {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid rgba(239,154,200,.6);
          display: grid;
          place-items: center;
          color: var(--rose);
          font: italic 700 25px Georgia, serif;
        }

        .brand strong,
        .brand small {
          display: block;
        }

        .brand small {
          margin-top: 2px;
          color: var(--mist);
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .header-link {
          font-size: 13px;
          color: #d7d0dc;
        }

        .hero {
          display: grid;
          place-items: center;
          padding: 130px 7vw 90px;
        }

        .hero-copy {
          max-width: 980px;
          text-align: center;
        }

        h2 {
          margin: 24px 0;
          font-size: clamp(64px, 9vw, 136px);
          font-weight: 500;
          line-height: 0.83;
          letter-spacing: -0.065em;
        }

        .hero-copy > p:not(.overline) {
          max-width: 760px;
          margin: 0 auto 30px;
          color: #c7bfcc;
          font-size: 20px;
          line-height: 1.65;
        }

        .hero-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .countdown {
          position: absolute;
          bottom: 42px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: clamp(20px, 5vw, 65px);
        }

        .countdown div {
          display: flex;
          flex-direction: column;
          text-align: center;
        }

        .countdown strong {
          color: var(--lavender);
          font: 500 36px Georgia, serif;
        }

        .countdown span {
          margin-top: 3px;
          color: var(--mist);
          font-size: 9px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .section-wrap {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
        }

        .literary-section,
        .chapters-section,
        .contribute-section {
          padding: 110px 0;
          border-top: 1px solid var(--line);
        }

        .literary-section {
          background:
            radial-gradient(circle at 20% 20%, rgba(239,154,200,.09), transparent 28%),
            rgba(255,255,255,.02);
          text-align: center;
        }

        blockquote {
          max-width: 980px;
          margin: 24px auto 0;
          font-size: clamp(34px, 5vw, 66px);
          font-style: italic;
          line-height: 1.18;
          color: #f8edf6;
        }

        .attribution {
          margin-top: 24px;
          color: var(--rose);
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .section-heading {
          max-width: 760px;
          margin-bottom: 44px;
        }

        .section-heading h3,
        .contribute-grid h3 {
          margin: 15px 0;
          font-size: clamp(43px, 6vw, 75px);
          font-weight: 500;
          line-height: 0.95;
        }

        .section-heading > p:last-child,
        .contribute-grid > div > p:last-child {
          color: var(--mist);
          font-size: 17px;
          line-height: 1.65;
        }

        .chapter-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }

        .chapter-card {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 24px;
          border: 1px solid var(--line);
          border-radius: 24px;
          background:
            linear-gradient(to top, rgba(9,8,13,.98), rgba(9,8,13,.1)),
            radial-gradient(circle at top right, rgba(239,154,200,.26), transparent 42%),
            var(--ink-soft);
        }

        .chapter-card:nth-child(even) {
          background:
            linear-gradient(to top, rgba(9,8,13,.98), rgba(9,8,13,.1)),
            radial-gradient(circle at top left, rgba(156,106,222,.32), transparent 42%),
            var(--ink-soft);
        }

        .chapter-card span {
          color: var(--rose);
          font-size: 10px;
          letter-spacing: 0.18em;
        }

        .chapter-card h4 {
          margin: 12px 0 8px;
          font-size: 32px;
          font-weight: 500;
        }

        .chapter-card p {
          margin: 0;
          color: var(--mist);
          font-size: 14px;
          line-height: 1.55;
        }

        .contribute-section {
          background: rgba(255,255,255,.025);
        }

        .contribute-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 48px;
          align-items: center;
        }

        .contribute-card {
          padding: 34px;
          border: 1px solid rgba(239,154,200,.25);
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(239,154,200,.08), rgba(156,106,222,.07));
        }

        .question {
          margin: 0 0 24px;
          font: italic 30px/1.25 Georgia, serif;
        }

        .full {
          width: 100%;
        }

        .support {
          margin: 16px 0 0;
          text-align: center;
          color: var(--mist);
          font-size: 12px;
        }

        footer {
          padding: 45px 20px 75px;
          border-top: 1px solid var(--line);
          text-align: center;
          color: #8f8997;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .chapter-grid {
            grid-template-columns: 1fr 1fr;
          }

          .contribute-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          h1 {
            font-size: 72px;
          }

          h2 {
            font-size: 68px;
          }

          .minimal-header {
            padding: 0 18px;
          }

          .brand small {
            display: none;
          }

          .countdown {
            gap: 18px;
          }

          .countdown strong {
            font-size: 27px;
          }

          .chapter-grid {
            grid-template-columns: 1fr;
          }

          .literary-section,
          .chapters-section,
          .contribute-section {
            padding: 80px 0;
          }

          .contribute-card {
            padding: 24px;
          }

          .whisper-line {
            bottom: 3%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </>
  );
}
