# MVP v0 Technical Plan: Deterministic Rhyme Engine

**Status**: Planning
**Target**: MVP v0 (Web-only, Client-side Engine)
**Based on**: `rhyme_engine_architecture_specification.md`

---

## 1. Scope Definition (MVP v0)

**The Objective**: efficient, deterministic, multi-scheme rhyme comparison running entirely in the user's browser.

### Strictly Included
*   **Web Application**: Single-page application (SPA).
*   **Client-Side Engine**: No server roundtrips for queries.
*   **Multi-Target Comparison**: User inputs multiple words (e.g., "love", "dove") and finds words that rhyme with *both* or score high against the set.
*   **Multi-Scheme Support**: Configurable weighting for Perfect Rhyme, Near Rhyme, and Stress Matching.
*   **Performance**: < 20ms response time for typical queries.

### Strictly Excluded
*   **Backend Capabilities**: No database, no API servers, no user accounts.
*   **AI/LLM**: No generative text, no "inspiration" features.
*   **Persistence**: No saving of sessions (even local persistence is low priority vs core engine correctness).
*   **Mobile Apps**: Web capabilities only (responsive design is nice-to-have, but desktop-first for MVP).

### Success Metric
*   The application loads, downloads artifacts, and allows a user to type "cat" and "bat" and see "mat" as a top result with a deterministic score explanation.

---

## 2. System Components

The system is composed of three distinct units with strict boundaries.

### A. Data Pipeline (Build-Time)
*   **Responsibility**: Convert raw linguistic data (CMU Dict) into optimized, compressed runtime artifacts.
*   **Input**: `cmudict-0.7b` (Text file).
*   **Output**: JSON artifacts (`lexicon.json`, `index_perfect.json`, `index_tail.json`).
*   **Tech**: TypeScript Node scripts.

### B. Rhyme Engine (Runtime Library)
*   **Responsibility**: Load artifacts, parse requests, execute scoring logic, return ranked results.
*   **Input**: `CompareRequest` object.
*   **Output**: `CompareResponse` object.
*   **Dependencies**: Zero UI dependencies. Pure TypeScript.

### C. Frontend UI (Application)
*   **Responsibility**: Render UI, manage connection to Engine, handle user input.
*   **Input**: User interactions.
*   **Output**: Visuals.
*   **Tech**: React + Vite + TailwindCSS (for speed/cleanliness).

---

## 3. Data Model & Structures

### Build Artifacts (JSON)

**1. Lexicon (`lexicon.json`)**
Map of `Word -> PhonemeData`.
```typescript
interface LexiconEntry {
  p: string[]; // Phonemes ["K", "AE1", "T"]
  s: string;   // Stress Pattern "1"
  c: number;   // Syllable Count 1
}
type Lexicon = Record<string, LexiconEntry>;
```

**2. Perfect Index (`index_perfect.json`)**
Key: Last Stressed Vowel + Tail.
```typescript
// Key: "AE1 T" -> Words ending in this sound
type PerfectIndex = Record<string, string[]>;
```

**3. Tail Index (`index_tail.json`)**
Key: Last N Phonemes (for N=2, 3). Used for near rhymes.
```typescript
type TailIndex = Record<string, string[]>;
```

### Runtime Structures

**Comparison Session**
```typescript
interface Session {
  targets: string[];          // ["heart", "art"]
  schemes: SchemeSetting[];   // Configuration
  filters: FilterSetting;     // { minSyllables: 1 }
}
```

---

## 4. Engine API Design

The Engine must be instantiated with loaded data.

```typescript
// engine/index.ts

export class RhymeEngine {
  constructor(
    private lexicon: Lexicon,
    private perfectIndex: PerfectIndex,
    private tailIndex: TailIndex
  ) {}

  /**
   * Main entry point for the UI.
   */
  public compare(req: CompareRequest): CompareResponse {
    // 1. Identify Candidate Set (Intersection of potential matches or broad search)
    // 2. Score Candidates against all Targets
    // 3. Sort and Rank
    // 4. Return top N
  }
}

export interface CompareRequest {
  targets: string[];
  schemes: SchemeConfig[]; // e.g. [{id: 'perfect', weight: 1.0}, {id: 'near', weight: 0.5}]
  limit?: number;
}

export interface CompareResponse {
  candidates: Candidate[];
}

export interface Candidate {
  word: string;
  totalScore: number;
  schemeScores: Record<string, number>; // { 'perfect': 1.0, 'near': 0.8 }
  breakdown: string[]; // Explanations
}
```

---

## 5. Scoring Model (MVP Version)

Scores are normalized `0.0` to `1.0`. Final score is a weighted average.

### Component 1: Perfect Rhyme (Weight Default: 1.0)
*   **Logic**: Does the `Last Stressed Vowel + Tail` match exactly?
*   **Score**: `1.0` (Yes) or `0.0` (No).

### Component 2: Phoneme Tail Similarity (Weight Default: 0.7)
*   **Logic**: Compare the last `N` phonemes (e.g., last 3).
*   **Score**: `SamePhonemes / MaxPhonemes`.
*   *Example*: "cat" (K AE T) vs "bat" (B AE T) -> Tails match perfectly.
*   *Example*: "orange" vs "door hinge".

### Component 3: Stress Match (Weight Default: 0.5)
*   **Logic**: Levenshtein distance on stress strings ("101" vs "101").
*   **Score**: `1.0` - (Distance / MaxLength).

### Aggregation
For a candidate `C` and targets `T1, T2`:
1.  Compute `Score(C, T1)` and `Score(C, T2)`.
2.  Combine Target Scores: `Average` or `Min` (User configurable? MVP: Average).
3.  `FinalScore = Sum(SchemeScore * Weight) / Sum(Weights)`.

---

## 6. Frontend Features (MVP)

**Layout**
*   **Header**: Title "Rhyme Engine v0".
*   **Search Bar**: Input field accommodating multiple "pill" tags for targets.
*   **Controls**: Sidebar or Top bar.
    *   Radio/Sliders for Scheme Weights (Perfect, Near, Stress).
*   **Result Area**:
    *   Virtual list or simple table.
    *   Row: Word | Score | Breakdown (mini-bars or text).

**User Flow**
1.  User types "dawn". Hits Enter. Added to targets.
2.  User types "on". Hits Enter. Added to targets.
3.  Client engine computes similarity intersection.
4.  List updates instantly with words like "fawn", "lawn", "gone".

---

## 7. Implementation Phases

**Phase 1: Data Pipeline**
*   **Goal**: Generate `public/data/*.json`.
*   **Task**: Write `scripts/build_dictionary.ts`.
    *   Parse `cmudict`.
    *   Extract necessary fields.
    *   Write JSON files.
*   **Verify**: Check file sizes. `lexicon.json` should be ~2-5MB gzipped.

**Phase 2: Engine Core**
*   **Goal**: `RhymeEngine` class passing tests.
*   **Task**:
    *   Implement data loading.
    *   Implement `scorePerfect()`.
    *   Implement `scoreNear()`.
    *   Implement `compare()`.
*   **Verify**: Unit tests with Jest/Vitest. `expect(engine.compare(['cat'], ...)).toContain('bat')`.

**Phase 3: UI Integration**
*   **Goal**: Browser interface.
*   **Task**:
    *   Setup Vite React project.
    *   `useEffect` to load JSONs on mount.
    *   Connect inputs to `engine.compare()`.
    *   Render results.
*   **Verify**: Manual testing. Latency check.

**Phase 4: Optimization**
*   **Goal**: Web Worker (Optional for MVP, but recommended if UI jank occurs).
*   **Task**: Move `RhymeEngine` to a Worker thread.

---

## 8. File/Folder Structure Proposal

```
/
├── data/                  # Raw inputs (cmudict)
├── public/
│   └── artifacts/         # Generated JSONs (gitignored or standard)
├── scripts/
│   └── build_data.ts      # Pipeline script
├── src/
│   ├── engine/
│   │   ├── index.ts       # Main Class
│   │   ├── types.ts
│   │   ├── scoring.ts
│   │   └── utils.ts
│   ├── ui/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── index.css
│   └── main.tsx
├── package.json
└── tsconfig.json
```

---

## 9. Explicitly Avoid

*   **DO NOT** Use a database (Postgres, SQLite, etc.).
*   **DO NOT** Create a Node.js backend server (Express/Fastify).
*   **DO NOT** Implement user login/signup.
*   **DO NOT** Integrate OpenAI/Anthropic APIs.
*   **DO NOT** Spend time on "Logo Design" or fancy branding. Use simple text.
*   **DO NOT** Worry about mobile layout perfection. Desktop speed is priority.
