
import type { Candidate, LexiconEntry, SchemeConfig } from './types';
import { getPerfectRhymeKey, levenshtein } from './utils';

export function scorePerfect(candidate: LexiconEntry, target: LexiconEntry): number {
    const cKey = getPerfectRhymeKey(candidate.p);
    const tKey = getPerfectRhymeKey(target.p);
    if (!cKey || !tKey) return 0;
    return cKey === tKey ? 1.0 : 0.0;
}

export function scoreNear(candidate: LexiconEntry, target: LexiconEntry, n: number = 3): number {
    const minLen = Math.min(candidate.p.length, target.p.length);
    const checkLen = Math.min(n, minLen);

    if (checkLen === 0) return 0;

    let matches = 0;
    // Check from the end backwards
    for (let i = 1; i <= checkLen; i++) {
        const cP = candidate.p[candidate.p.length - i];
        const tP = target.p[target.p.length - i];
        if (cP === tP) {
            matches++;
        } else {
            // Stop at first mismatch for a strict tail rhyme?
            // "Orange" (AH0 N JH) and "Hinge" (IH1 N JH). Last 2 match. Last 3 (R / IH1) mismatch.
            // If we stop: matches = 2. Score = 2/3 = 0.66.
            // Correct.
            break;
        }
    }

    // We normalize by 'n' to reward longer matches up to limit n
    return matches / n;
}

export function scoreStress(candidate: LexiconEntry, target: LexiconEntry): number {
    const dist = levenshtein(candidate.s, target.s);
    const maxLen = Math.max(candidate.s.length, target.s.length);
    if (maxLen === 0) return 0;
    return Math.max(0, 1.0 - (dist / maxLen));
}

export function scoreCandidate(
    candidateWord: string,
    candidateEntry: LexiconEntry,
    targets: LexiconEntry[],
    schemes: SchemeConfig[]
): Candidate {
    const schemeScores: Record<string, number> = {};
    const breakdowns: string[] = [];

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const scheme of schemes) {
        let schemeVal = 0;

        let sumTargetScores = 0;
        for (const target of targets) {
            let val = 0;
            switch (scheme.id) {
                case 'perfect':
                    val = scorePerfect(candidateEntry, target);
                    break;
                case 'near':
                    val = scoreNear(candidateEntry, target); // Default N=3
                    break;
                case 'stress':
                    val = scoreStress(candidateEntry, target);
                    break;
            }
            sumTargetScores += val;
        }

        // Average score against all targets
        schemeVal = targets.length > 0 ? sumTargetScores / targets.length : 0;

        schemeScores[scheme.id] = schemeVal;

        totalWeightedScore += schemeVal * scheme.weight;
        totalWeight += scheme.weight;
    }

    const finalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return {
        word: candidateWord,
        totalScore: finalScore,
        schemeScores,
        breakdown: breakdowns
    };
}
