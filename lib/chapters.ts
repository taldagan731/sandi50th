export const STORY_CHAPTERS = [
  "Once Upon a Time",
  "Growing Up in Roslyn",
  "Finding Her Voice",
  "Building Something Bigger",
  "The Family She Chose",
  "Around the World",
  "The People Who Love Her",
  "Still Becoming"
] as const;

export function chapterNumberFromContributor(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  const numeric = normalized.match(/\b([1-8])\b/);
  if (numeric) return Number(numeric[1]);

  if (/baby|early childhood/.test(normalized)) return 1;
  if (/roslyn|school years/.test(normalized)) return 2;
  if (/boston university|semester abroad|england/.test(normalized)) return 3;
  if (/magazine advertising|oracle|career/.test(normalized)) return 4;
  if (/family|love/.test(normalized)) return 5;
  if (/travel|adventure/.test(normalized)) return 6;
  if (/friendship|people who love/.test(normalized)) return 7;
  if (/sandi today|birthday wishes|still becoming/.test(normalized)) return 8;

  const exact = STORY_CHAPTERS.findIndex(title => title.toLowerCase() === normalized);
  return exact >= 0 ? exact + 1 : null;
}
