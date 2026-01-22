
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
}
