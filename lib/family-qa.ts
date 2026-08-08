import { STORY_CHAPTERS } from "@/lib/chapters";

export type FamilyQaMetadata = {
  kind: "family_qa";
  sourceId: string;
  chorusKeys: string[];
  photoAssetIds: string[];
  photoRefs: string[];
  showInChapter: boolean;
  editorialNote?: string;
};

export type FamilyQaAnswer = {
  id: string;
  contributorName: string;
  relationship: string;
  question: string;
  answer: string;
  chapterNumber: number;
  when: string;
  place: string;
  chorusKeys: string[];
  photoAssetIds: string[];
  photoRefs: string[];
  showInChapter: boolean;
  editorialNote?: string;
};

export const FAMILY_CHORUSES = [
  { key: "who-is-sandi", question: "Who is Sandi to you?" },
  { key: "what-do-you-admire", question: "What do you admire most about Sandi?" },
  { key: "what-makes-you-laugh", question: "What makes you laugh together?" }
] as const;

export const FAMILY_QA_PENDING = [
  {
    contributorName: "Zevi",
    relationship: "Nephew — please confirm",
    note: "The supplied file contains questions for Zevi, age 12, but no answers."
  },
  {
    contributorName: "Sabrina",
    relationship: "Niece — please confirm",
    note: "The supplied file contains questions for Sabrina, age 9, but no answers."
  }
] as const;

const jenny = {
  contributorName: "Jenny Yadegari",
  relationship: "Sister",
  when: "",
  place: "",
  photoAssetIds: [] as string[],
  photoRefs: [] as string[]
};

const emile = {
  contributorName: "Emile Banayan",
  relationship: "Family member — please confirm",
  when: "",
  place: "",
  photoAssetIds: [] as string[],
  photoRefs: [] as string[]
};

export const FAMILY_QA_SEED: FamilyQaAnswer[] = [
  {
    ...jenny,
    id: "jenny-older-sister",
    question: "What was Sandi like as an older sister?",
    answer: "Sandi always looked out for me as my older sister. Even though people usually think I am older, Sandi is definitely the one who protects me and who I go to when I need advice about anything.",
    chapterNumber: 7,
    chorusKeys: ["who-is-sandi"],
    showInChapter: true
  },
  {
    ...jenny,
    id: "jenny-greece-funny",
    question: "What is the funniest thing the two of you ever did together?",
    answer: "One of the funniest things we did together was travel to Greece. It was very fun, and we have some very funny memories from that trip: the fly who was going to ‘die hard,’ the cab driver who burst into our room looking for the person who booked a ride and disappeared, walking to eat in one-hundred-degree weather, and being treated as outsiders on the ship.",
    chapterNumber: 6,
    chorusKeys: [],
    showInChapter: false,
    editorialNote: "The source used a more charged description of the ship incident. This lightly edited display copy preserves the event without publishing that comparison; review before enabling."
  },
  {
    ...jenny,
    id: "jenny-more-trouble",
    question: "Who got into more trouble?",
    answer: "I definitely got into more trouble, but when it came to trouble with our mom, Sandi usually bailed me out. I think Sandi got into more trouble hanging out with me and my friends.",
    chapterNumber: 2,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...jenny,
    id: "jenny-competitive",
    question: "Who was more competitive?",
    answer: "We are not really competitive with each other.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: false
  },
  {
    ...jenny,
    id: "jenny-bedroom",
    question: "Did you ever share a bedroom?",
    answer: "No, we never shared a bedroom.",
    chapterNumber: 2,
    chorusKeys: [],
    showInChapter: false
  },
  {
    ...jenny,
    id: "jenny-arguments",
    question: "What did you argue about?",
    answer: "Our last argument was on the phone over politics. Other than that, we do not really argue a lot.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: false
  },
  {
    ...jenny,
    id: "jenny-laugh-hardest",
    question: "What makes you laugh the hardest?",
    answer: "Things our parents do definitely make us laugh the hardest. Or, if we go out somewhere and someone says something strange, we look at each other and laugh because we have the same sense of humor. ‘Cookie crumb…’",
    chapterNumber: 7,
    chorusKeys: ["what-makes-you-laugh"],
    showInChapter: true
  },
  {
    ...jenny,
    id: "jenny-only-us",
    question: "What is something only the two of you understand?",
    answer: "Our crazy parents—and our secret nicknames for certain people.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...jenny,
    id: "jenny-greece-vacation",
    question: "What family vacation stands out?",
    answer: "Our Greece vacation definitely stands out for me.",
    chapterNumber: 6,
    chorusKeys: [],
    showInChapter: true,
    place: "Greece"
  },
  {
    ...jenny,
    id: "jenny-proud",
    question: "When have you been most proud of her?",
    answer: "I am proud that Sandi does not let things get to her and keeps moving forward in life. I am proud that she took on the role of stepmom and does the job better than anyone else I know. She takes care of all the kids and genuinely loves them.",
    chapterNumber: 5,
    chorusKeys: ["what-do-you-admire"],
    showInChapter: true
  },
  {
    ...jenny,
    id: "jenny-unrealized",
    question: "What is one thing people do not realize about Sandi?",
    answer: "She is very sweet and calm, but if you make her angry, you had better watch out. She is not one to be pushed around.",
    chapterNumber: 8,
    chorusKeys: [],
    showInChapter: false,
    editorialNote: "The source uses profanity for emphasis. This display copy is lightly softened; review before enabling."
  },
  {
    ...jenny,
    id: "jenny-admire-now",
    question: "What do you admire most about her now?",
    answer: "I admire how she does not let unimportant things bother her and always tries to look at the positive side of things.",
    chapterNumber: 8,
    chorusKeys: ["what-do-you-admire"],
    showInChapter: true
  },
  {
    ...jenny,
    id: "jenny-relive-greece",
    question: "If you could relive one day together, which would it be?",
    answer: "I would probably relive the Greece trip because it was our first trip together and we made so many memories.",
    chapterNumber: 6,
    chorusKeys: [],
    showInChapter: true,
    place: "Greece"
  },
  {
    ...emile,
    id: "emile-first-impression",
    question: "What was your first impression of Sandi, and did it prove accurate?",
    answer: "I found Sandi to be very nice, accepting, and engaging. That first impression proved accurate.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-emotional-intelligence",
    question: "What did you notice about her that others might not?",
    answer: "Sandi is quite calm, listens well, and has a high emotional intelligence.",
    chapterNumber: 7,
    chorusKeys: ["what-do-you-admire"],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-unchanged",
    question: "How has Sandi changed since you have known her?",
    answer: "She has not changed much, which is great. She remains a very nice, loving, and understanding person who is easy to talk to and very approachable.",
    chapterNumber: 8,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-gatherings",
    question: "What role does she naturally play in family gatherings?",
    answer: "Her presence always makes the event better.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-enters-room",
    question: "What usually happens when Sandi walks into a room?",
    answer: "Happiness follows, and people gravitate toward her.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-greatest-strength",
    question: "What do you think Sandi’s greatest strength is?",
    answer: "Her calm demeanor and ability to listen well. You feel heard, and she seems interested in what you have to say. She follows up with you if something was not going well.",
    chapterNumber: 7,
    chorusKeys: ["what-do-you-admire"],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-people-gravitate",
    question: "What qualities make people gravitate toward her?",
    answer: "Her loving ways. She is a people person and is genuinely interested in what people have to say.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-laughing",
    question: "What is your funniest memory involving Sandi?",
    answer: "I do not have one particular memory that comes to mind, but I definitely recall laughing out loud with her often.",
    chapterNumber: 7,
    chorusKeys: ["what-makes-you-laugh"],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-at-ease",
    question: "What is a moment with Sandi that you will never forget?",
    answer: "It is simply spending time with her and being at ease around her.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-ny-la",
    question: "Which family vacation or holiday stands out most?",
    answer: "All the visits to New York, or when she comes to Los Angeles, have been great.",
    chapterNumber: 6,
    chorusKeys: [],
    showInChapter: true,
    place: "New York and Los Angeles"
  },
  {
    ...emile,
    id: "emile-inside-joke",
    question: "Is there an inside joke involving Sandi that the family still laughs about?",
    answer: "‘Tiramisu, Emmy.’",
    chapterNumber: 7,
    chorusKeys: ["what-makes-you-laugh"],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-age",
    question: "What is something she has become even better at with age?",
    answer: "Sandi does not seem to have aged since I first met her.",
    chapterNumber: 8,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-difficult-situation",
    question: "Have you seen Sandi handle a difficult situation in a way that impressed you?",
    answer: "Her ability to remain calm has impressed me many times.",
    chapterNumber: 8,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-awesome-aunt",
    question: "What is one moment when you thought, ‘That is exactly who Sandi is’?",
    answer: "It is her ability to relate to people and empathize with them. That has been a constant, along with her ability to be an awesome aunt to all her nieces and nephews.",
    chapterNumber: 7,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-stepmother",
    question: "What have you admired about the way Sandi embraced becoming a stepmother?",
    answer: "Sandi has been an amazing stepmother. She treats the kids like they are her own, teaches them right from wrong, makes them feel comfortable around her, and provides love. The kids trust her and go to her to discuss their concerns and needs. She is like another mother to them.",
    chapterNumber: 5,
    chorusKeys: ["what-do-you-admire"],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-next-adventure",
    question: "What do you hope the next chapter of Sandi’s life looks like?",
    answer: "A trip to Los Angeles and a local adventure to Santa Barbara, San Diego, or Palm Springs—or meeting Jenny somewhere outside New York and Los Angeles so they can both take a break from the chaos. Most importantly, I hope she keeps doing whatever makes her happy, maintains optimal health, and enjoys that tiramisu from time to time.",
    chapterNumber: 8,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-wish",
    question: "If you could give Sandi one wish for the next fifty years, what would it be?",
    answer: "Do not change. Keep being your authentic self.",
    chapterNumber: 8,
    chorusKeys: [],
    showInChapter: true
  },
  {
    ...emile,
    id: "emile-who-is-sandi",
    question: "If someone who had never met Sandi asked, ‘Who is she?’ what story would you tell?",
    answer: "A sister. She is a wonderful, loving person who is easy to relate to and even easier to talk to. She is the one who will give you a hug and always ask how you are doing.",
    chapterNumber: 7,
    chorusKeys: ["who-is-sandi"],
    showInChapter: true
  }
];

export function chapterLabel(chapterNumber: number) {
  return `${chapterNumber} — ${STORY_CHAPTERS[chapterNumber - 1] ?? "Still Becoming"}`;
}

export function encodeFamilyQaMetadata(answer: Pick<FamilyQaAnswer, "id" | "chorusKeys" | "photoAssetIds" | "photoRefs" | "showInChapter" | "editorialNote">) {
  return JSON.stringify({
    kind: "family_qa",
    sourceId: answer.id,
    chorusKeys: answer.chorusKeys,
    photoAssetIds: answer.photoAssetIds,
    photoRefs: answer.photoRefs,
    showInChapter: answer.showInChapter,
    ...(answer.editorialNote ? { editorialNote: answer.editorialNote } : {})
  } satisfies FamilyQaMetadata);
}

export function decodeFamilyQaMetadata(value: string | null | undefined): FamilyQaMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<FamilyQaMetadata>;
    if (parsed.kind !== "family_qa" || typeof parsed.sourceId !== "string") return null;
    return {
      kind: "family_qa",
      sourceId: parsed.sourceId,
      chorusKeys: Array.isArray(parsed.chorusKeys) ? parsed.chorusKeys.filter(item => typeof item === "string") : [],
      photoAssetIds: Array.isArray(parsed.photoAssetIds) ? parsed.photoAssetIds.filter(item => typeof item === "string") : [],
      photoRefs: Array.isArray(parsed.photoRefs) ? parsed.photoRefs.filter(item => typeof item === "string") : [],
      showInChapter: parsed.showInChapter !== false,
      ...(typeof parsed.editorialNote === "string" ? { editorialNote: parsed.editorialNote } : {})
    };
  } catch {
    return null;
  }
}
