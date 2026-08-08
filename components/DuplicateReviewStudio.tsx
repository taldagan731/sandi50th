"use client";

import { useEffect, useMemo, useState } from "react";

type Match = {
  id: string;
  source_media_id: string;
  candidate_media_id: string;
  match_kind: "exact" | "near";
  hamming_distance: number | null;
  confidence: number;
  contributor_action: "unreviewed" | "keep" | "exclude";
  studio_status: "open" | "merged" | "different";
};

type Media = {
  id: string;
  submission_id: string;
  original_name: string;
  bytes: number;
  image_width: number | null;
  image_height: number | null;
  canonical_media_id: string | null;
  review_status: "included" | "excluded";
};

type Submission = {
  id: string;
  name: string;
  relationship: string;
};

type Payload = {
  available: boolean;
  error?: string;
  matches: Match[];
  media: Media[];
  submissions: Submission[];
  counts?: { open: number; exact: number; merged: number; different: number };
};

type Group = {
  id: string;
  mediaIds: string[];
  matches: Match[];
};

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function connectedGroups(matches: Match[]) {
  const open = matches.filter(match => match.studio_status === "open");
  const adjacency = new Map<string, Set<string>>();
  for (const match of open) {
    const left = adjacency.get(match.source_media_id) ?? new Set<string>();
    const right = adjacency.get(match.candidate_media_id) ?? new Set<string>();
    left.add(match.candidate_media_id);
    right.add(match.source_media_id);
    adjacency.set(match.source_media_id, left);
    adjacency.set(match.candidate_media_id, right);
  }

  const visited = new Set<string>();
  const groups: Group[] = [];
  for (const first of adjacency.keys()) {
    if (visited.has(first)) continue;
    const stack = [first];
    const mediaIds: string[] = [];
    while (stack.length) {
      const current = stack.pop() as string;
      if (visited.has(current)) continue;
      visited.add(current);
      mediaIds.push(current);
      for (const neighbor of adjacency.get(current) ?? []) stack.push(neighbor);
    }
    const selected = new Set(mediaIds);
    groups.push({
      id: [...mediaIds].sort().join(":"),
      mediaIds,
      matches: open.filter(match => selected.has(match.source_media_id) && selected.has(match.candidate_media_id))
    });
  }
  return groups.sort((left, right) => {
    const leftConfidence = Math.max(...left.matches.map(item => Number(item.confidence)));
    const rightConfidence = Math.max(...right.matches.map(item => Number(item.confidence)));
    return rightConfidence - leftConfidence;
  });
}

export function DuplicateReviewStudio() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/studio/duplicates", { cache: "no-store" });
    const body = await response.json();
    setPayload(body);
  }

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(() => connectedGroups(payload?.matches ?? []), [payload]);
  const mediaById = useMemo(() => new Map((payload?.media ?? []).map(item => [item.id, item])), [payload]);
  const submissionById = useMemo(() => new Map((payload?.submissions ?? []).map(item => [item.id, item])), [payload]);

  async function decide(group: Group, action: "merge" | "different") {
    setWorking(group.id);
    setNotice("");
    const response = await fetch("/api/studio/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, mediaIds: group.mediaIds })
    });
    const body = await response.json();
    if (!response.ok) setNotice(body.error || "The group could not be updated.");
    else {
      setNotice(action === "merge"
        ? `Merged for presentation. All ${body.originalsRetained} originals remain stored and ${body.creditedSubmissions} contributor source${body.creditedSubmissions === 1 ? "" : "s"} remain credited.`
        : "Marked genuinely different. Every photograph remains available.");
      await load();
    }
    setWorking("");
  }

  if (!payload) return null;

  return (
    <details className="studioTools duplicateStudio" open={groups.length > 0}>
      <summary>Possible repeats <span>{groups.length}</span></summary>
      <section aria-labelledby="duplicate-studio-title">
        <header className="duplicateStudioHeader">
          <div>
            <span className="eyebrow">POSSIBLE REPEATS</span>
            <h2 id="duplicate-studio-title">Keep every memory. Present the clearest copy.</h2>
            <p>These comparisons happen after storage. Merging changes only which copy appears in the reveal; every original and every contributor credit remains preserved.</p>
          </div>
          <dl>
            <div><dt>To review</dt><dd>{groups.length}</dd></div>
            <div><dt>Exact</dt><dd>{payload.counts?.exact ?? 0}</dd></div>
            <div><dt>Merged</dt><dd>{payload.counts?.merged ?? 0}</dd></div>
            <div><dt>Different</dt><dd>{payload.counts?.different ?? 0}</dd></div>
          </dl>
        </header>

        {!payload.available && <p className="studioWarning">{payload.error}</p>}
        {payload.available && !groups.length && <p className="studioEmpty">No possible repeats are waiting for review.</p>}
        <div className="duplicateStudioGroups">
          {groups.map(group => {
            const confidence = Math.max(...group.matches.map(match => Number(match.confidence)));
            return (
              <article className="duplicateStudioGroup" key={group.id}>
                <header>
                  <div><span>{Math.round(confidence * 100)}% similarity</span><strong>{group.mediaIds.length} versions</strong></div>
                  <small>High-confidence comparisons appear first.</small>
                </header>
                <div className="duplicateStudioMedia">
                  {group.mediaIds.map(mediaId => {
                    const item = mediaById.get(mediaId);
                    if (!item) return null;
                    const contributor = submissionById.get(item.submission_id);
                    return (
                      <figure key={item.id}>
                        <img src={`/api/studio/media/${item.id}`} alt={`Possible repeated photograph from ${contributor?.name || "a contributor"}`} loading="lazy" />
                        <figcaption>
                          <strong>{contributor?.name || "Contributor"}</strong>
                          <span>{contributor?.relationship || "Contributor"}</span>
                          <small>{item.image_width && item.image_height ? `${item.image_width} × ${item.image_height} · ` : ""}{formatBytes(Number(item.bytes))}</small>
                          <small>{item.original_name}</small>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
                <div className="duplicateStudioActions">
                  <button type="button" disabled={working === group.id} onClick={() => decide(group, "merge")}>Merge group · keep clearest for reveal</button>
                  <button type="button" disabled={working === group.id} onClick={() => decide(group, "different")}>These are genuinely different</button>
                </div>
              </article>
            );
          })}
        </div>
        {notice && <p className="studioNotice" role="status">{notice}</p>}
      </section>
    </details>
  );
}
