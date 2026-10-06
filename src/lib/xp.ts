// XP economy. Kept in one place so the reward loop stays balanced.
export const XP = {
  cardReviewed: 2,
  cardKnown: 1,
  correct: 10,
  correctChallenge: 20,
  wrongEffort: 2,
  quizComplete: 25,
  quizStrong: 25, // >= 80%
  perfectQuiz: 40,
  learnConcept: 15,
  guideSection: 5,
  guideComplete: 50,
  conceptMastered: 50,
  materialAdded: 20,
  dailyStreakPerDay: 10, // multiplied by streak length, capped
  streakCap: 7,
};

export const MASTERY_THRESHOLD = 85;

export function nextMastery(prev: number, correct: boolean, weight = 1): number {
  const gain = correct ? (100 - prev) * 0.28 * weight : -prev * 0.22 * weight;
  return Math.max(0, Math.min(100, prev + gain));
}
