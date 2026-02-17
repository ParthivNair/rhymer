import { RhymeEngine } from '../src/engine/index';
import { Lexicon, PerfectIndex, TailIndex } from '../src/engine/types';

const lexicon: Lexicon = {
    "CAT": { p: ["K", "AE1", "T"], s: "1", c: 1 },
    "BAT": { p: ["B", "AE1", "T"], s: "1", c: 1 },         // Perfect, Rank 100
    "GNAT": { p: ["N", "AE1", "T"], s: "1", c: 1 },        // Perfect, Rank 10000
    "SCAT": { p: ["S", "K", "AE1", "T"], s: "1", c: 1 },   // Perfect, Rank 5000

    // Near Rhyme: "MATTE" (let's pretend it's near for demo, though it's perfect)
    // Let's make "DOG" a near rhyme candidates just to force a lower score
    "DOG": { p: ["D", "AO1", "G"], s: "1", c: 1 },         // No match really, but we'll force score

    // Let's try a better real near rhyme for CAT -> "COT" (AA1 T vs AE1 T) - Consonant match
    "COT": { p: ["K", "AA1", "T"], s: "1", c: 1 },

    // Hypothetical very popular near rhyme
    "POPULAR_NEAR": { p: ["P", "AA1", "T"], s: "1", c: 1 }, // "POT" - Rank 1

    // Hypothetical obscure perfect rhyme
    "OBSCURE_PERFECT": { p: ["Z", "AE1", "T"], s: "1", c: 1 }, // "ZAT" - Rank 99999
};

// We need to fake the return of scoreCandidate or rely on actual scoring.
// scoring.ts uses scorePerfect and scoreNear.
// CAT (AE1 T) vs POT (AA1 T). Perfect score = 0. Near score (n=3) -> T=T (1 match), AA1!=AE1. Score = 1/3 = 0.33. N=2 -> T=T (1 match) -> 0.5.
// Let's use a mock scoring override if needed, or just rely on what we have.
// Let's stick to real logic.
// CAT: K AE1 T
// POT: P AA1 T. Last phoneme T matches.
// Perfect score: 0
// Near score: T (match), AA1 vs AE1 (no). 
// If we use Near weight 1.0, score is low.

const perfectIndex: PerfectIndex = {};
const tailIndex: TailIndex = {};

const frequencyMap = new Map<string, number>([
    ["BAT", 100],
    ["GNAT", 10000],
    ["SCAT", 5000],
    ["COT", 200], // Rank 200
    ["POPULAR_NEAR", 1],
    ["OBSCURE_PERFECT", 99999]
]);

const engine = new RhymeEngine(lexicon, perfectIndex, tailIndex, frequencyMap);

console.log("--- Ranking for 'CAT' ---");
const result = engine.compare({
    targets: ["CAT"],
    schemes: [
        { id: 'perfect', weight: 1.0 },
    ],
    limit: 10
});

// Note: scorePerfect returns 1.0 or 0.0.
// So OBSCURE_PERFECT will get 1.0.
// POPULAR_NEAR ("POT") will get 0.0 for perfect scheme. 
// So OBSCURE_PERFECT should win regardless of popularity if we only verify perfect scheme.

// Let's mix schemes.
console.log("\n--- Mixed Schemes ---");
const resultMixed = engine.compare({
    targets: ["CAT"],
    schemes: [
        { id: 'perfect', weight: 0.5 }, // 50%
        { id: 'near', weight: 0.5 }     // 50%
    ],
    limit: 10
});

resultMixed.candidates.forEach((c, i) => {
    console.log(`${i + 1}. ${c.word} \t Total: ${c.totalScore.toFixed(3)} \t Pop: ${c.popularityScore?.toFixed(3)} \t Comp: ${c.compositeScore?.toFixed(3)} \t Rank: ${c.frequencyRank}`);
});
