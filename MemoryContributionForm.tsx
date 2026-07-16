"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

const chapters = [
  "Baby and early childhood",
  "Growing up in Roslyn",
  "School years",
  "Boston University",
  "Semester abroad in England",
  "Magazine advertising",
  "Oracle and career achievements",
  "Family and love",
  "Travel and adventure",
  "Friendship",
  "Sandi today",
  "Birthday wishes",
  "Not sure"
];

const prompts = [
  "What moment best captures who Sandi is?",
  "What is your earliest memory of Sandi?",
  "Tell us the funniest Sandi story you know.",
  "What has Sandi taught you?",
  "How has Sandi changed your life?",
  "What do you wish for her next fifty years?"
];

type SelectedFile = { file: File; id: string };

export function MemoryContributionForm() {
  const [firstMemory, setFirstMemory] = useState("");
  const [opened, setOpened] = useState(false);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const totalSize = useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files]
  );

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).map(file => ({
      file,
      id: `${file.name}-${file.size}-${file.lastModified}`
    }));
    setFiles(current => {
      const ids = new Set(current.map(item => item.id));
      return [...current, ...selected.filter(item => !ids.has(item.id))].slice(0, 20);
    });
    event.target.value = "";
  }

  function removeFile(id: string) {
    setFiles(current => current.filter(item => item.id !== id));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <section className="contributionSuccess" aria-live="polite">
        <span className="successMark">✓</span>
        <span className="eyebrow">YOUR MEMORY IS READY</span>
        <h2>Thank you for becoming part of Sandi’s story.</h2>
        <p>
          This visual build is not yet connected to cloud storage, so the files have not left your device. The secure upload connection will be activated before invitations are sent.
        </p>
        <button className="secondary" type="button" onClick={() => setSubmitted(false)}>
          Return to the form
        </button>
      </section>
    );
  }

  return (
    <form className="memoryForm" onSubmit={submit}>
      <section className="memoryOpening panel">
        <span className="eyebrow">BEGIN WITH THE STORY</span>
        <label className="openingQuestion">
          When you think of Sandi, what is the first memory that comes to mind?
          <textarea
            rows={6}
            value={firstMemory}
            onChange={event => setFirstMemory(event.target.value)}
            placeholder="Do not worry about writing beautifully. Tell us what happened, where you were, and why you still remember it."
            required
          />
        </label>
        {!opened && (
          <button
            type="button"
            className="primary"
            disabled={!firstMemory.trim()}
            onClick={() => setOpened(true)}
          >
            Continue the story
          </button>
        )}
      </section>

      {opened && (
        <div className="contributionColumns">
          <section className="panel formDetails">
            <span className="eyebrow">THE DETAILS BEHIND THE MEMORY</span>
            <div className="grid2 contributionGrid">
              <label>Your name<input name="name" required placeholder="How Sandi knows you" /></label>
              <label>Email or phone<input name="contact" required placeholder="For project updates only" /></label>
              <label>Your relationship to Sandi
                <select name="relationship" defaultValue="Friend">
                  <option>Family</option><option>Friend</option><option>Childhood friend</option><option>College friend</option><option>Colleague</option><option>Neighbor</option><option>Other</option>
                </select>
              </label>
              <label>Approximate year<input name="year" placeholder="Example: 1988 or early 2000s" /></label>
              <label>Where did this happen?<input name="place" placeholder="Roslyn, Boston, England, a family trip…" /></label>
              <label>Who appears in it?<input name="people" placeholder="Names, if known" /></label>
            </div>

            <label>Where does this belong in her story?
              <select name="chapter" defaultValue="Not sure">
                {chapters.map(chapter => <option key={chapter}>{chapter}</option>)}
              </select>
            </label>

            <label>Choose a prompt for your birthday message
              <select name="prompt">{prompts.map(prompt => <option key={prompt}>{prompt}</option>)}</select>
            </label>

            <label>The fuller story
              <textarea name="story" rows={5} placeholder="Add details, an inside joke, what happened before or after, or why the memory matters." />
            </label>

            <div className="uploadBox">
              <span className="uploadGlyph">↑</span>
              <h3>Share photographs, video, audio, or keepsakes</h3>
              <p>Baby pictures and childhood videos of Sandi are especially valuable. You may choose up to twenty items in this version.</p>
              <label className="filePicker primary">
                Choose files
                <input type="file" multiple accept="image/*,video/*,audio/*,.pdf" onChange={addFiles} />
              </label>
            </div>

            {files.length > 0 && (
              <div className="selectedFiles">
                <div className="fileSummary"><strong>{files.length} item{files.length === 1 ? "" : "s"}</strong><span>{formatBytes(totalSize)} selected</span></div>
                {files.map(item => (
                  <article key={item.id}>
                    <span className="fileType">{mediaType(item.file.type)}</span>
                    <div><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)}</small></div>
                    <button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => removeFile(item.id)}>×</button>
                  </article>
                ))}
              </div>
            )}

            <label className="consent contributionConsent">
              <input type="checkbox" required />
              <span>I have permission to share these materials in Sandi’s private birthday film and archive.</span>
            </label>

            <button className="primary submitMemory" type="submit">Prepare my contribution</button>
            <p className="secureNote">The live cloud connection is intentionally disabled in this build until secure storage is configured.</p>
          </section>

          <aside className="panel contributionGuide">
            <span className="eyebrow">WHAT WE HOPE YOU WILL FIND</span>
            <h2>Look beyond your camera roll.</h2>
            <ul>
              <li>Baby and childhood photographs of Sandi</li>
              <li>Roslyn school pictures and home movies</li>
              <li>Boston University and England memories</li>
              <li>Old family holidays and funny candid moments</li>
              <li>Oracle photographs, awards, and colleague stories</li>
              <li>Letters, cards, drawings, invitations, or keepsakes</li>
              <li>A personal 30–120 second birthday message</li>
            </ul>
            <div className="recordingTip">
              <span>For a beautiful video</span>
              <p>Face a window, hold the phone horizontally, keep it steady, and pause for two seconds before and after speaking.</p>
            </div>
            <p className="helpAddress">Need help?<br/><a href="mailto:uploads@sandi50th.com">uploads@sandi50th.com</a></p>
          </aside>
        </div>
      )}
    </form>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function mediaType(type: string) {
  if (type.startsWith("image")) return "PHOTO";
  if (type.startsWith("video")) return "VIDEO";
  if (type.startsWith("audio")) return "AUDIO";
  return "FILE";
}
