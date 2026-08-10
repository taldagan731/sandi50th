import { chapterNumberFromContributor } from "@/lib/chapters";

type SubmissionDisplayInput = {
  status?: string | null;
  prompt?: string | null;
  first_memory?: string | null;
  story?: string | null;
  life_chapter?: string | null;
  approximate_year?: string | null;
  location?: string | null;
  relationship?: string | null;
};

const SYNTHETIC_ONLY_TEXT = [
  /^owner archive batch\.?$/i,
  /^photographs? or video shared for sandi'?s birthday story\.?$/i,
  /^photos?\.?$/i,
  /^video shared for sandi'?s birthday story\.?$/i,
  /^voice recording shared for sandi'?s birthday story\.?$/i,
  /^birthday (?:video|message) shared for sandi'?s birthday story\.?$/i,
  /^name chorus recording\.?$/i
];

function isSynthetic(value: string) {
  return SYNTHETIC_ONLY_TEXT.some(pattern => pattern.test(value.trim()));
}

export function genuineSubmissionText(item: SubmissionDisplayInput) {
  if (item.status === "family_qa" || item.prompt?.toUpperCase() === "OWNER_ARCHIVE") return null;
  let firstMemory = item.first_memory?.trim() ?? "";
  let story = item.story?.trim() ?? "";
  if (isSynthetic(firstMemory)) firstMemory = "";
  if (isSynthetic(story)) story = "";
  if (!firstMemory && !story) return null;
  return { firstMemory, story };
}

export function displayChapterForSubmission(item: SubmissionDisplayInput) {
  const assigned = chapterNumberFromContributor(item.life_chapter);
  if (assigned) return assigned;

  const prompt = item.prompt?.toUpperCase() ?? "";
  if (prompt === "BIRTHDAY_MESSAGE") return 8;
  if (prompt === "VOICE_WALL" || prompt === "NAME_CHORUS") return 7;

  const text = [item.first_memory, item.story, item.approximate_year, item.location, item.relationship]
    .filter(Boolean).join(" ").toLocaleLowerCase();
  if (/\b(baby|infant|toddler|born|birth|early childhood)\b/.test(text)) return 1;
  if (/\b(roslyn|elementary|middle school|high school|school years|summer camp|sleepaway camp|teenager)\b/.test(text)) return 2;
  if (/\b(boston university|\bbu\b|college|university|semester abroad|studied abroad|young adult)\b/.test(text)) return 3;
  if (/\b(oracle|career|workplace|worked with|advertising|magazine|colleague|office)\b/.test(text)) return 4;
  if (/\b(stepmom|stepmother|family|children|child|kids|cousin|niece|nephew|sister|brother|mother|father|mom|dad)\b/.test(text)) return 5;
  if (/\b(travel|trip|vacation|adventure|iceland|spain|england|france|italy|greece|puerto rico|israel|london|paris|beach)\b/.test(text)) return 6;
  if (/\b(friend|friendship|people|community|admire|kindness|support|together|love her|loves her)\b/.test(text)) return 7;
  if (/\b(birthday|fiftieth|50th|today|future|still becoming|wish|wishing)\b/.test(text)) return 8;

  return 7;
}
