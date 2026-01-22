
export interface LexiconEntry {
    p: string[]; // Phonemes ["K", "AE1", "T"]
    s: string;   // Stress Pattern "1"
    c: number;   // Syllable Count 1
}

export type Lexicon = Record<string, LexiconEntry>;

// Key: "AE1 T" -> Words ending in this sound
export type PerfectIndex = Record<string, string[]>;

// Key: Last N Phonemes
export type TailIndex = Record<string, string[]>;

export interface SchemeConfig {
    id: 'perfect' | 'near' | 'stress';
    weight: number;
}

export interface CompareRequest {
    targets: string[];
    schemes: SchemeConfig[];
    limit?: number;
}

export interface Candidate {
    word: string;
    totalScore: number;
    schemeScores: Record<string, number>; // { 'perfect': 1.0, 'near': 0.8 }
    breakdown: string[]; // Explanations
    frequencyRank?: number; // 0 = most common, higher = less common, undefined = unknown
}

export interface CompareResponse {
    candidates: Candidate[];
}
