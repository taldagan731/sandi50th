"use client";

type LiveMedia = {
  id: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  review_status: "pending" | "included" | "excluded";
  poster_path: string | null;
};

export type LiveSubmission = {
  id: string;
  name: string;
  relationship: string;
  first_memory: string;
  story: string;
  prompt: string;
  status: string;
  review_status: "pending" | "included" | "excluded";
  created_at: string;
  upload_completed_at?: string | null;
  media: LiveMedia[];
};

type Props = {
  submissions: LiveSubmission[];
  newIds: Set<string>;
  lastRefreshed: Date | null;
  onVisibilityChange: (submissionId: string, status: "included" | "excluded") => Promise<void>;
};

function isBirthdayMessage(item: LiveMedia, submission: LiveSubmission) {
  return /birthday[-_ ]?message/i.test(item.original_name)
    || /birthday message/i.test(submission.prompt || "");
}

function labelFor(item: LiveMedia, submission: LiveSubmission) {
  if (isBirthdayMessage(item, submission)) return "Birthday message";
  if (item.mime_type.startsWith("audio/")) return "Voice recording";
  if (item.mime_type.startsWith("video/")) return "Video";
  if (item.mime_type.startsWith("image/")) return "Photograph";
  return "File";
}

function easternTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

export function StudioLiveFeed({ submissions, newIds, lastRefreshed, onVisibilityChange }: Props) {
  const media = submissions.flatMap(submission => submission.media.map(item => ({ item, submission })));
  const photos = media.filter(({ item }) => item.mime_type.startsWith("image/")).length;
  const videos = media.filter(({ item }) => item.mime_type.startsWith("video/")).length;
  const birthdayMessages = media.filter(({ item, submission }) => isBirthdayMessage(item, submission)).length;
  const voiceRecordings = media.filter(({ item, submission }) =>
    item.mime_type.startsWith("audio/") && !isBirthdayMessage(item, submission)
  ).length;

  return (
    <section className="liveArrivals" aria-labelledby="live-arrivals-title">
      <header className="liveArrivalsHeader">
        <div>
          <span className="eyebrow">LIVE ARRIVALS</span>
          <h2 id="live-arrivals-title">Everything, as it comes in.</h2>
          <p className="liveStatus" aria-live="polite">
            <span aria-hidden="true" />
            Checking every 20 seconds
            {lastRefreshed ? <> · Last checked {lastRefreshed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</> : null}
          </p>
        </div>
        <dl className="liveCounts" aria-label="Contribution counts">
          <div><dt>Total</dt><dd>{submissions.length}</dd></div>
          <div><dt>Photos</dt><dd>{photos}</dd></div>
          <div><dt>Videos</dt><dd>{videos}</dd></div>
          <div><dt>Voice</dt><dd>{voiceRecordings}</dd></div>
          <div><dt>Birthday</dt><dd>{birthdayMessages}</dd></div>
        </dl>
      </header>

      {!submissions.length ? (
        <div className="liveEmpty">
          <strong>No contributions are visible yet.</strong>
          <p>The feed is connected and will update automatically. If private storage contains files but this remains empty, an error will be shown above rather than silently presenting an empty room.</p>
        </div>
      ) : (
        <div className="liveFeed" aria-live="polite" aria-relevant="additions">
          {submissions.map(submission => {
            const isNew = newIds.has(submission.id);
            const isHidden = submission.review_status === "excluded";
            return (
              <article className={`liveItem${isNew ? " isNew" : ""}${isHidden ? " isHidden" : ""}`} key={submission.id}>
                <header className="liveItemHeader">
                  <div>
                    <div className="liveIdentity">
                      {isNew && <span className="newArrival">New</span>}
                      <span>{submission.relationship || "Contributor"}</span>
                    </div>
                    <h3>{submission.name}</h3>
                  </div>
                  <time dateTime={submission.created_at}>{easternTime(submission.created_at)}</time>
                </header>

                <div className="liveStory">
                  {submission.first_memory && <p className="livePrompt">{submission.first_memory}</p>}
                  {submission.story && <p>{submission.story}</p>}
                </div>

                {submission.media.length > 0 && (
                  <div className="liveMedia">
                    {submission.media.map(item => {
                      const mediaUrl = `/api/studio/media/${item.id}`;
                      const label = labelFor(item, submission);
                      return (
                        <figure key={item.id}>
                          <div className="liveMediaFrame">
                            {item.mime_type.startsWith("image/") ? (
                              <img src={mediaUrl} alt={`${label} from ${submission.name}: ${item.original_name}`} loading="lazy" />
                            ) : item.mime_type.startsWith("video/") ? (
                              <video
                                controls
                                playsInline
                                preload="metadata"
                                poster={item.poster_path ? `${mediaUrl}?poster=1` : undefined}
                              >
                                <source src={mediaUrl} type={item.mime_type} />
                              </video>
                            ) : item.mime_type.startsWith("audio/") ? (
                              <div className="liveAudio">
                                <span>{label}</span>
                                <audio controls preload="metadata">
                                  <source src={mediaUrl} type={item.mime_type} />
                                </audio>
                              </div>
                            ) : (
                              <a href={mediaUrl} target="_blank" rel="noreferrer">Open {item.original_name}</a>
                            )}
                          </div>
                          <figcaption>{label} · {item.original_name}</figcaption>
                        </figure>
                      );
                    })}
                  </div>
                )}

                {!submission.media.length && <p className="textOnlyMemory">Text memory</p>}

                <footer className="liveItemFooter">
                  <span>{isHidden ? "Excluded from the reveal" : "Visible on the site"}</span>
                  <button
                    type="button"
                    className={isHidden ? "include" : "exclude"}
                    onClick={() => onVisibilityChange(submission.id, isHidden ? "included" : "excluded")}
                  >
                    {isHidden ? "Restore" : "Exclude"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
