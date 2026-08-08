import { chapterNumberFromContributor, isTestContributor, STORY_CHAPTERS } from "@/lib/chapters";

type ReportMedia = {
  original_name?: string | null;
  mime_type?: string | null;
  review_status?: string | null;
  chapter_number?: number | null;
};

type ReportSubmission = {
  name?: string | null;
  status?: string | null;
  review_status?: string | null;
  first_memory?: string | null;
  story?: string | null;
  life_chapter?: string | null;
  prompt?: string | null;
  media?: ReportMedia[] | null;
};

export type ContributionReport = {
  totals: {
    photographs: number;
    videos: number;
    voiceRecordings: number;
    birthdayMessages: number;
    writtenMemories: number;
    qaAnswers: number;
  };
  chapters: Array<{
    number: number;
    title: string;
    photographs: number;
    videos: number;
    voiceRecordings: number;
    birthdayMessages: number;
    writtenMemories: number;
    qaAnswers: number;
    total: number;
    thin: boolean;
  }>;
  excludedSubmissions: number;
  excludedFiles: number;
  unassignedItems: number;
};

const SPECIAL_TEXT_PROMPTS = new Set(["VOICE_WALL", "BIRTHDAY_MESSAGE", "NAME_CHORUS", "OWNER_ARCHIVE"]);

function isBirthdayMessage(media: ReportMedia, submission: ReportSubmission) {
  return submission.prompt === "BIRTHDAY_MESSAGE" || /birthday[-_ ]?message/i.test(media.original_name ?? "");
}

function chapterFor(submission: ReportSubmission, media?: ReportMedia) {
  return media?.chapter_number ?? chapterNumberFromContributor(submission.life_chapter);
}

export function buildContributionReport(submissions: ReportSubmission[]): ContributionReport {
  const chapters = STORY_CHAPTERS.map((title, index) => ({
    number: index + 1,
    title,
    photographs: 0,
    videos: 0,
    voiceRecordings: 0,
    birthdayMessages: 0,
    writtenMemories: 0,
    qaAnswers: 0,
    total: 0,
    thin: false
  }));
  const totals = {
    photographs: 0,
    videos: 0,
    voiceRecordings: 0,
    birthdayMessages: 0,
    writtenMemories: 0,
    qaAnswers: 0
  };
  let excludedSubmissions = 0;
  let excludedFiles = 0;
  let unassignedItems = 0;

  for (const submission of submissions) {
    const excluded = isTestContributor(submission.name) || submission.review_status === "excluded";
    if (excluded) {
      excludedSubmissions += 1;
      excludedFiles += (submission.media ?? []).length;
      continue;
    }

    const isQa = submission.status === "family_qa";
    const hasWrittenMemory = !isQa
      && !SPECIAL_TEXT_PROMPTS.has(submission.prompt ?? "")
      && Boolean((submission.first_memory ?? "").trim() || (submission.story ?? "").trim());
    if (isQa || hasWrittenMemory) {
      const key = isQa ? "qaAnswers" : "writtenMemories";
      totals[key] += 1;
      const chapterNumber = chapterFor(submission);
      if (chapterNumber) chapters[chapterNumber - 1][key] += 1;
      else unassignedItems += 1;
    }

    for (const media of submission.media ?? []) {
      if (media.review_status === "excluded") {
        excludedFiles += 1;
        continue;
      }
      if ((submission.prompt ?? "") === "NAME_CHORUS") continue;

      let key: "photographs" | "videos" | "voiceRecordings" | "birthdayMessages" | null = null;
      if (isBirthdayMessage(media, submission)) key = "birthdayMessages";
      else if ((media.mime_type ?? "").startsWith("image/")) key = "photographs";
      else if ((media.mime_type ?? "").startsWith("video/")) key = "videos";
      else if ((media.mime_type ?? "").startsWith("audio/")) key = "voiceRecordings";
      if (!key) continue;

      totals[key] += 1;
      const chapterNumber = chapterFor(submission, media);
      if (chapterNumber) chapters[chapterNumber - 1][key] += 1;
      else unassignedItems += 1;
    }
  }

  for (const chapter of chapters) {
    chapter.total = chapter.photographs + chapter.videos + chapter.voiceRecordings
      + chapter.birthdayMessages + chapter.writtenMemories + chapter.qaAnswers;
    chapter.thin = chapter.total <= 2;
  }

  return { totals, chapters, excludedSubmissions, excludedFiles, unassignedItems };
}
