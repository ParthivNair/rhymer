
import type { Lexicon, PerfectIndex, TailIndex, CompareRequest, CompareResponse, Candidate } from './types';
import { scoreCandidate } from './scoring';

export class RhymeEngine {
    private lexicon: Lexicon;
    // @ts-ignore
    private perfectIndex: PerfectIndex;
    // @ts-ignore
    private tailIndex: TailIndex;
    private frequencyMap: Map<string, number>;

    constructor(
        lexicon: Lexicon,
        perfectIndex: PerfectIndex,
        tailIndex: TailIndex,
        frequencyMap?: Map<string, number>
    ) {
        this.lexicon = lexicon;
        this.perfectIndex = perfectIndex;
        this.tailIndex = tailIndex;
        this.frequencyMap = frequencyMap || new Map();
    }

    public compare(req: CompareRequest): CompareResponse {
        const start = performance.now();

        // 1. Resolve Targets
        const normalizedTargets = req.targets.map(t => t.toUpperCase());
        const targetEntries = normalizedTargets
            .map(t => this.lexicon[t])
            .filter(x => !!x);

        if (targetEntries.length === 0) {
            return { candidates: [] };
        }

        // 2. Score Candidates
        const candidates: Candidate[] = [];
        const limit = req.limit || 50;
        const minScoreThreshold = 0.3; // Noise floor

        for (const [word, entry] of Object.entries(this.lexicon)) {
            // Exclude targets themselves
            if (normalizedTargets.includes(word)) continue;

            const scoreResult = scoreCandidate(word, entry, targetEntries, req.schemes);

            if (scoreResult.totalScore >= minScoreThreshold) {
                // Attach frequency rank (lower is better/more popular)
                const rank = this.frequencyMap.get(word); // Make sure word case matches map keys
                scoreResult.frequencyRank = rank !== undefined ? rank : 999999;
                candidates.push(scoreResult);
            }
        }

        // 3. Sort: Primary by Score (DESC), Secondary by Frequency Rank (ASC)
        candidates.sort((a, b) => {
            const scoreDiff = b.totalScore - a.totalScore;
            if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
            return (a.frequencyRank || 999999) - (b.frequencyRank || 999999);
        });

        const end = performance.now();
        console.debug(`Comparision took ${(end - start).toFixed(2)}ms for ${candidates.length} candidates.`);

        // 4. Return top N
        return {
            candidates: candidates.slice(0, limit)
        };
    }

    public checkRhyme(wordA: string, wordB: string): boolean {
        const w1 = wordA.toUpperCase().trim();
        const w2 = wordB.toUpperCase().trim();

        if (w1 === w2) return true; // Same word rhymes with itself for highlighting purposes

        // Helper to resolve entry with fuzzy fallback
        const resolve = (w: string) => {
            if (this.lexicon[w]) return this.lexicon[w];
            // Fuzzy 1: "IN" -> "ING"
            if (w.endsWith("IN")) {
                const tryIng = w.substring(0, w.length - 2) + "ING";
                if (this.lexicon[tryIng]) return this.lexicon[tryIng];
            }
            return null;
        };

        const entryA = resolve(w1);
        const entryB = resolve(w2);

        if (!entryA || !entryB) return false;

        // 1. Check Perfect Rhyme
        const perfectScore = scoreCandidate(w1, entryA, [entryB], [{ id: 'perfect', weight: 1 }]);
        if (perfectScore.totalScore === 1.0) return true;

        // 2. Check Near Rhyme (Tail)
        // Relaxed threshold for highlighting? > 0.5?
        const nearScore = scoreCandidate(w1, entryA, [entryB], [{ id: 'near', weight: 1 }]);
        if (nearScore.totalScore >= 0.6) return true;

        // 3. Check Assonance (Internal Rhyme - Stressed Vowel Match)
        // Find primary stressed vowel in phonemes.
        // Phonemes format: ["K", "AE1", "T"]
        const getStressedVowel = (p: string[]) => p.find(ph => ph.includes('1') || ph.includes('2')); // 1=Primary, 2=Secondary? Usually 1.

        const vA = getStressedVowel(entryA.p);
        const vB = getStressedVowel(entryB.p);

        if (vA && vB) {
            // Strip stress number for comparison? "AE1" vs "AE2"? Usually exact match for strong assonance.
            // But let's check exact match first.
            if (vA === vB) return true;
        }

        return false;
    }
}
