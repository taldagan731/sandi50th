"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Countdown } from "@/components/Countdown";

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
    if (reduceMotion) setIntroDone(true);
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
              The way we remember you.
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
            <p className="privateNote">A private 50th-birthday film for Sandi Yadegari</p>
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
              <span className="eyebrow">A SECRET CELEBRATION · AUGUST 11, 2026</span>
              <h1>Every life leaves a <em>constellation.</em></h1>
              <p>
                We are gathering the photographs, home movies, stories, voices, and little forgotten moments that together tell the story of Sandi’s first fifty years.
              </p>
              <div className="deadlineCallout">
                <span>✦</span>
                <div>
                  <strong>Please contribute by August 7.</strong>
                  <small>Baby pictures, childhood videos, family photographs, keepsakes, audio memories, and birthday messages are all welcome.</small>
                </div>
              </div>
              <div className="actions leftActions">
                <Link className="primary" href="/contribute">Share a memory</Link>
                <a className="secondary" href="#invitation">See what we’re creating</a>
              </div>
              <Countdown />
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
