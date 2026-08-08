"use client";

import { useEffect, useState } from "react";

export type PhotoMatch = {
  id: string;
  confidence: number;
  mine: {
    mediaId: string;
    name: string;
    width: number | null;
    height: number | null;
    bytes: number;
    src: string;
  };
  collection: {
    mediaId: string;
    name: string;
    width: number | null;
    height: number | null;
    bytes: number;
    src: string;
  };
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function dimensions(item: PhotoMatch["mine"]) {
  return item.width && item.height ? `${item.width} × ${item.height}` : "Dimensions unavailable";
}

export function PostUploadPhotoReview({
  submissionId,
  reviewToken,
  demoMatches
}: {
  submissionId: string;
  reviewToken: string | null;
  demoMatches?: PhotoMatch[];
}) {
  const [matches, setMatches] = useState<PhotoMatch[]>(demoMatches ?? []);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState((demoMatches?.length ?? 0) <= 5);

  useEffect(() => {
    if (demoMatches || !reviewToken || !submissionId) return;
    let cancelled = false;
    let attempts = 0;
    let timer = 0;

    async function check() {
      attempts += 1;
      try {
        const response = await fetch(`/api/submissions/${submissionId}/duplicates`, {
          headers: { "x-duplicate-review-token": reviewToken },
          cache: "no-store"
        });
        const body = await response.json();
        if (!cancelled && response.ok && Array.isArray(body.matches)) {
          setMatches(body.matches);
          setExpanded(body.matches.length <= 5);
          if (!body.pending || attempts >= 12) return;
        }
      } catch {
        // Detection is optional and can fail without changing the successful contribution.
      }
      if (!cancelled && attempts < 12) timer = window.setTimeout(check, 2500);
    }

    timer = window.setTimeout(check, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [demoMatches, reviewToken, submissionId]);

  async function choose(match: PhotoMatch, action: "keep" | "exclude") {
    if (demoMatches) {
      setMatches(current => current.filter(item => item.id !== match.id));
      setNotice(action === "exclude"
        ? "Your original remains safely stored and has been left out of the reveal."
        : "We’ll keep your version in the collection.");
      return;
    }
    if (!reviewToken) return;
    setDeciding(match.id);
    setNotice("");
    try {
      const response = await fetch(`/api/submissions/${submissionId}/duplicates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-duplicate-review-token": reviewToken
        },
        body: JSON.stringify({ matchId: match.id, action })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The choice could not be saved.");
      setMatches(current => current.filter(item => item.id !== match.id));
      setNotice(action === "exclude"
        ? "Your original remains safely stored and has been left out of the reveal."
        : "We’ll keep your version in the collection.");
    } catch {
      setNotice("Nothing changed. Your photograph is still safely stored, and you may try again.");
    } finally {
      setDeciding(null);
    }
  }

  if (!matches.length && !notice) return null;

  return (
    <section className="postUploadPhotoReview" aria-labelledby="photo-review-title">
      <span className="eyebrow">OPTIONAL · AFTER YOUR GIFT IS SAFE</span>
      <h3 id="photo-review-title">A few of these may already be in the collection — no problem either way.</h3>
      <p>Everything you sent is safely stored. Take a look if you’d like. If you do nothing, we’ll keep yours.</p>

      {matches.length > 5 && !expanded ? (
        <button className="duplicateGroupToggle" type="button" onClick={() => setExpanded(true)}>
          Look through {matches.length} possible matches
        </button>
      ) : (
        <div className="photoMatchList">
          {matches.map(match => (
            <article className="photoMatch" key={match.id}>
              <div className="photoMatchPair">
                <figure>
                  <img src={match.mine.src} alt={`Your photograph, ${match.mine.name}`} />
                  <figcaption>
                    <strong>Your photograph</strong>
                    <span>{dimensions(match.mine)} · {formatBytes(match.mine.bytes)}</span>
                  </figcaption>
                </figure>
                <figure>
                  <img src={match.collection.src} alt={`Photograph already held in the collection, ${match.collection.name}`} />
                  <figcaption>
                    <strong>In the collection</strong>
                    <span>{dimensions(match.collection)} · {formatBytes(match.collection.bytes)}</span>
                  </figcaption>
                </figure>
              </div>
              <div className="photoMatchActions" aria-label={`Choose which version to present for ${match.mine.name}`}>
                <button type="button" disabled={deciding === match.id} onClick={() => choose(match, "keep")}>
                  Keep mine
                </button>
                <button type="button" disabled={deciding === match.id} onClick={() => choose(match, "exclude")}>
                  Remove mine — yours is better
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {notice && <p className="photoReviewNotice" role="status">{notice}</p>}
    </section>
  );
}
