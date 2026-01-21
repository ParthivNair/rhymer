# Rhyme Engine Architecture Specification

**Purpose**  
This document defines the recommended architecture for building a modern, high‑performance rhyme comparison web application ("RhymeZone with multi‑scheme comparison") with a clear evolution path toward future LLM-powered creative features.

The core principle is to treat rhyme analysis as a **deterministic linguistic search problem**, not an AI problem. A dedicated Rhyme Engine provides speed, correctness, and predictability. Generative AI is layered on later as an optional assistant.

---

## Architectural Goals

- Fast, near‑instant interaction (<20ms response for most operations)
- Deterministic and explainable rhyme scoring
- Modular separation between:
  - UI
  - Rhyme Engine
  - Data pipeline
  - Future LLM services
- Web-first MVP, with scalability to desktop/mobile/server
- Future-proof design (versioned data, stable APIs, extensible scoring)

---

## Core Architectural Principles

### 1. Engine / UI Separation
The rhyme engine must be a pure, deterministic module:

- Input: words/phrases + scheme definitions
- Output: ranked candidates + structured explanation metadata

UI remains responsible only for interaction, visualization, and state management.

This separation allows:
- Easier testing
- Faster iteration on scoring models
- Multiple frontends (web, desktop, mobile) sharing the same engine

---

### 2. Precomputation Over Runtime Computation
Performance comes from **pre-indexed linguistic data**, not complex runtime logic.

Rather than scanning a dictionary each query, the system relies on:

- Precomputed rhyme keys
- Phoneme tail indexes
- Stress pattern indexes
- Syllable count buckets

This allows most queries to be resolved by fast lookup instead of brute-force search.

---

### 3. Client-First Performance
The ideal experience feels instant while typing and toggling options.

Primary strategy:
- Ship compressed linguistic artifacts to the browser
- Execute rhyme comparisons locally (TypeScript or WASM)
- Use server only for persistence and optional heavy features

This minimizes infrastructure cost while maximizing responsiveness.

---

### 4. Versioned Data and Reproducibility
All linguistic assets must be versioned:

- Dictionary version
- Index version
- Scoring model version

Every engine response should be traceable to a specific data version for debugging, trust, and future migrations.

---

## System Overview

The architecture is divided into four layers:

1. **Data Pipeline (build-time)**
2. **Rhyme Engine (runtime, deterministic)**
3. **Web Application (UI + state)**
4. **Future LLM Assistant (optional, layered on top)**

---

## 1. Data Pipeline (Build-Time System)

This is a small offline system responsible for transforming raw linguistic sources into optimized runtime artifacts.

### Inputs
- CMU Pronouncing Dictionary (phonemes + stress)
- Word frequency lists (for ranking)
- Optional extensions:
  - Part-of-speech tags
  - Syllable segmentation
  - Grapheme-to-phoneme model (for out-of-vocabulary words)

### Outputs
A versioned artifact bundle containing:

- `lexicon`  
  Word → phonemes, stress pattern, syllable count, metadata

- `perfect_rhyme_index`  
  Key: last stressed vowel + trailing phonemes  
  Value: list of word IDs

- `phoneme_tail_index`  
  Key: last N phonemes (2–5)  
  Value: list of word IDs

- `stress_pattern_index`  
  Key: stress pattern (e.g., 0-1-0)  
  Value: list of word IDs

- `syllable_count_index`  
  Key: syllable count  
  Value: list of word IDs

These artifacts can initially be stored as compressed JSON and later upgraded to binary formats for efficiency.

---

## 2. Rhyme Engine (Deterministic Core)

The engine consumes the artifact bundle and exposes a stable query interface.

### Core Responsibility
Given:
- One or more target tokens (words/phrases)
- A set of rhyme schemes
- Filters (syllables, frequency, POS, etc.)

Return:
- Ranked candidate list
- Per-scheme scores
- Explainable matching metadata

### Example API Contract

Request:
```
POST /compare
{
  "targets": ["connection", "protection"],
  "schemes": [
    {"type": "perfect_end_rhyme", "weight": 1.0},
    {"type": "near_end_rhyme", "max_distance": 2, "weight": 0.6},
    {"type": "stress_match", "weight": 0.4},
    {"type": "syllable_count", "value": 3, "weight": 0.3}
  ],
  "filters": {"min_frequency": 3},
  "limit": 200
}
```

Response:
- Ranked candidates
- Individual scores per scheme
- Explanation data (matched phoneme tail, stress alignment, etc.)

This contract must remain stable over time to allow UI and future services to evolve independently.

---

## 3. Runtime Execution Model

### Tier 1: Client-Side Engine (Primary Path)

- Engine runs directly in the browser
- Artifact bundle loaded via CDN
- Results computed locally for instant feedback

Implementation options:
- TypeScript engine (fastest MVP path)
- Rust → WebAssembly engine (best long-term performance)

Benefits:
- Minimal infrastructure cost
- Excellent responsiveness
- Offline-capable
- Easy scaling

---

### Tier 2: Server-Side Engine (Fallback + Future Use)

A server-hosted version of the same engine can exist for:

- Older devices
- Heavy queries
- API access
- External integrations

The server uses the same artifact bundle and identical logic to ensure consistent behavior.

---

## 4. Web Application Layer

The web app manages:

- User interaction
- Comparison workspace
- Visualization of scores
- Scheme toggles
- Session persistence

### Core UI Features for MVP

- Multiple target words/phrases
- Scheme selection panel
- Ranked candidate table
- Per-scheme score indicators
- Explainability UI (why something rhymes)

Persistence can begin with:
- LocalStorage or IndexedDB

And later evolve to:
- Account-based saved projects
- Cloud sync (Postgres/Supabase)

---

## Future Layer: LLM-Powered "Inspiration Box"

The LLM should never replace the deterministic engine. It should **consume the engine's structured output**.

### Correct Direction

1. Engine computes accurate rhyme candidates and scores
2. LLM receives:
   - Target words
   - Selected schemes
   - Top-ranked candidates
   - Explanation metadata
   - Optional user text/context
3. LLM generates creative inspiration grounded in verified rhyme data

### Benefits
- Trustworthy suggestions
- Explainable creativity
- Avoids hallucinated rhyme quality

### Deployment Strategy

- Separate microservice
- Explicit user action ("Generate inspiration")
- Rate-limited, not continuous
- Optional premium feature later

---

## Deployment Evolution Path

### Phase 1: Static Web MVP
- Next.js or Vite frontend
- Client-side engine
- CDN-hosted artifacts
- No backend required initially

### Phase 2: Persistence + Accounts
- Minimal backend (auth + session storage)
- Postgres (Supabase acceptable)
- Sessions stored as JSON

### Phase 3: Advanced Services
- Server-side engine API
- LLM inspiration service
- Analytics and personalization

---

## Technology Guidance

### Engine
- Best long-term: Rust (shared between WASM + server)
- Acceptable MVP: TypeScript with clear abstraction boundaries

### Artifact Storage
- Start: gzipped JSON
- Later: FlatBuffers / Cap'n Proto / custom binary format

### Client Caching
- IndexedDB cache keyed by version
- Artifact version checks on load

### Versioning Strategy
Each engine response should include:
- dictionary_version
- index_version
- engine_version

This ensures traceability and safe evolution.

---

## MVP Build Order

1. Implement data pipeline (dictionary → indexes)
2. Build deterministic rhyme engine
3. Create comparison UI
4. Add local session persistence
5. Only after core is strong: introduce backend, then LLM layer

---

## Summary

This architecture prioritizes:

- Speed
- Determinism
- Explainability
- Long-term extensibility

It enables a clean MVP today while preserving a direct path toward advanced creative features tomorrow, without forcing architectural rewrites.

The core product remains strong and valuable even without AI — and the AI layer becomes a true enhancement rather than a crutch.

