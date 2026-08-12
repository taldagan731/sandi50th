"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

const whispers = [
  "New Hyde Park · where the story began",
  "Roslyn · a childhood shaped by family and books",
  "Boston · English, psychology, and a wider world",
  "England · a semester that became part of her story",
  "Oracle · leadership, systems, and global impact",
  "Iceland · Spain · France · Italy · Israel",
  "Some families begin with birth. Others begin with choice."
];

export function OpeningExperience() {
  const reduceMotion = useReducedMotion();
  const [entered, setEntered] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (!reduceMotion) return;
    const timer = window.setTimeout(() => setIntroDone(true), 0);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <section className="opening" aria-label="The Story of Sandi introduction">
      <div className="aurora auroraOne" />
      <div className="aurora auroraTwo" />
      <div className="constellation" aria-hidden="true" />

      <AnimatePresence mode="wait">
        {!entered ? (
          <motion.div
            key="cover"
            className="cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: reduceMotion ? 0 : 1.2 }}
          >
            <motion.p
              className="coverLine"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.6, duration: 1 }}
              onAnimationComplete={() => setIntroDone(true)}
            >
              The way we see you.
            </motion.p>
            <motion.button
              className="beginButton"
              type="button"
              onClick={() => setEntered(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: introDone ? 1 : 0 }}
              transition={{ duration: .8 }}
            >
              Begin
              <span aria-hidden="true">↘</span>
            </motion.button>
            <p className="privateNote">A private film and living archive for Sandi Yadegari</p>
          </motion.div>
        ) : (
          <motion.div
            key="story"
            className="openingStory shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 1.3 }}
          >
            <motion.div
              className="storyCopy"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : .35, duration: 1 }}
            >
              <span className="eyebrow">THE ARCHIVE CONTINUES</span>
              <h1>Every life leaves a <em>constellation.</em></h1>
              <p>
                The birthday film has been seen, but the story is still moving. New memories, photographs, messages, and pages from Sandi herself still belong here.
              </p>
              <div className="deadlineCallout">
                <span>✦</span>
                <div>
                  <strong>Contributions are still welcome.</strong>
                  <small>Family photographs, keepsakes, voice notes, and the next pages of Chapter Nine can keep the archive alive.</small>
                </div>
              </div>
              <div className="actions leftActions">
                <Link className="primary" href="/contribute">Share a memory</Link>
                <Link className="secondary" href="/chapter-nine">Open Chapter Nine</Link>
              </div>
            </motion.div>

            <motion.div
              className="storyMark"
              initial={{ opacity: 0, scale: .94, rotate: 2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: reduceMotion ? 0 : .65, duration: 1.2 }}
              aria-hidden="true"
            >
              <div className="storyArch">
                <span className="fifty">50</span>
                <span className="sandiName">Sandi Yadegari</span>
                <span className="filmName">Still Becoming</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {entered && (
        <div className="whisperRail" aria-hidden="true">
          <div className="whisperTrack">
            {[...whispers, ...whispers].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}
