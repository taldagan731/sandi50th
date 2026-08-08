import { FAMILY_QA_SEED } from "@/lib/family-qa";

type FamilyQaStoredSnapshot = {
  sourceId: string;
  relationship: string;
  answer: string;
  showInChapter: boolean;
  editorialNote?: string;
};

const suppliedById = new Map(FAMILY_QA_SEED.map(answer => [answer.id, answer]));

export function applyFamilyQaSourceCorrections<T extends FamilyQaStoredSnapshot>(stored: T): T {
  const supplied = suppliedById.get(stored.sourceId);
  if (!supplied) return stored;

  const staleEmileRelationship = stored.sourceId.startsWith("emile-")
    && stored.relationship === "Family member — please confirm";
  const staleGreeceAnswer = stored.sourceId === "jenny-greece-funny"
    && (stored.answer.includes("being treated as outsiders on the ship")
      || stored.editorialNote?.includes("charged description") === true);
  const staleCandidAnswer = stored.sourceId === "jenny-unrealized"
    && (stored.answer.includes("if you make her angry")
      || stored.editorialNote?.includes("uses profanity for emphasis") === true);

  if (!staleEmileRelationship && !staleGreeceAnswer && !staleCandidAnswer) return stored;

  return {
    ...stored,
    ...(staleEmileRelationship ? { relationship: supplied.relationship } : {}),
    ...(staleGreeceAnswer || staleCandidAnswer ? {
      answer: supplied.answer,
      showInChapter: supplied.showInChapter,
      editorialNote: supplied.editorialNote
    } : {})
  };
}
