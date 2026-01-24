
import { useState, useEffect, useRef, useMemo } from 'react';
import { RhymeEngine } from '../engine';
import type { Candidate, Lexicon, PerfectIndex, TailIndex } from '../engine/types';
import { InspirationService } from '../engine/InspirationService';
import RhymeResultList from './components/RhymeResultList';
import AutoScalingInput from './components/AutoScalingInput';

// Constants
const BASE_URL = import.meta.env.BASE_URL || '/';
const ARTIFACTS_PATH = `${BASE_URL.endsWith('/') ? BASE_URL : BASE_URL + '/'}artifacts`;

interface DictionaryState {
  loading: boolean;
  engine: RhymeEngine | null;
  error: string | null;
}

function App() {
  const [dictState, setDictState] = useState<DictionaryState>({
    loading: true,
    engine: null,
    error: null,
  });

  const [targets, setTargets] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [resultSets, setResultSets] = useState<{ target: string; candidates: Candidate[] }[]>([]);

  // Inspiration Mode State
  const [inspirationMode, setInspirationMode] = useState(false);
  const [inspirationText, setInspirationText] = useState('');
  const [inspirationLines, setInspirationLines] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  // Replaced Set with Map for specific color tracking per word
  const [wordColors, setWordColors] = useState<Map<number, number>>(new Map());
  const [nextColorId, setNextColorId] = useState(0);
  const inspirationService = useRef(new InspirationService());

  const HIGHLIGHT_COLORS = [
    'bg-pink-900 text-pink-200',
    'bg-emerald-900 text-emerald-200',
    'bg-amber-900 text-amber-200',
    'bg-blue-900 text-blue-200',
    'bg-purple-900 text-purple-200',
    'bg-cyan-900 text-cyan-200',
    'bg-rose-900 text-rose-200',
    'bg-indigo-900 text-indigo-200',
  ];

  // Load Dictionary on Mount
  useEffect(() => {
    async function loadData() {
      try {


        const fetchResource = async (filename: string) => {
          const url = `${ARTIFACTS_PATH}/${filename}`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to load ${filename}: ${res.status} ${res.statusText}`);
          }
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error(`JSON parse error for ${filename}. content snippet: ${text.slice(0, 50)}...`);
            throw new Error(`Invalid JSON in ${filename}: ${(e as Error).message}`);
          }
        };

        const [lexicon, perfectIndex, tailIndex, freqText] = await Promise.all([
          fetchResource('lexicon.json'),
          fetchResource('index_perfect.json'),
          fetchResource('index_tail.json'),
          (async () => {
            const res = await fetch(`${ARTIFACTS_PATH}/frequency_list.txt`);
            if (!res.ok) return '';
            return await res.text();
          })()
        ]) as [Lexicon, PerfectIndex, TailIndex, string];

        // Process frequency list
        const frequencyMap = new Map<string, number>();
        const lines = freqText.split('\n');
        lines.forEach((line, index) => {
          const word = line.trim().toUpperCase();
          if (word) {
            frequencyMap.set(word, index);
          }
        });

        const engine = new RhymeEngine(lexicon, perfectIndex, tailIndex, frequencyMap);
        setDictState({ loading: false, engine, error: null });


      } catch (err: any) {
        console.error(err);
        setDictState({ loading: false, engine: null, error: err.message || "Unknown error" });
      }
    }

    loadData();
  }, []);

  // Run Comparison when targets change (Normal Mode)
  useEffect(() => {
    if (!dictState.engine || targets.length === 0) {
      setResultSets([]);
      return;
    }

    const newSets: { target: string; candidates: Candidate[] }[] = [];

    for (const t of targets) {
      const res = dictState.engine.compare({
        targets: [t],
        schemes: [
          { id: 'perfect', weight: 1.0 },
          { id: 'near', weight: 0.7 },
          { id: 'stress', weight: 0.5 },
        ],
        limit: 100
      });
      newSets.push({ target: t, candidates: res.candidates });
    }

    setResultSets(newSets);
  }, [targets, dictState.engine]);

  // Sync Inspiration Text when switching modes
  useEffect(() => {
    if (inspirationMode && targets.length > 0 && !inspirationText) {
      // User requested fresh start flow, disabling auto-fill for now or making it subtle
    }
  }, [inspirationMode]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !targets.includes(val)) {
        setTargets([...targets, val]);
        setInputValue('');
      }
    }
  };

  const removeTarget = (t: string) => {
    setTargets(targets.filter(x => x !== t));
  };

  const toggleHighlightIndex = (index: number) => {
    const words = inspirationText.trim().split(/\s+/);
    if (!words[index]) return;

    // Clean punctuation for rhyme check
    const cleanFn = (w: string) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    const targetWord = cleanFn(words[index]);

    const newMap = new Map(wordColors);

    // If we are selecting a word, we also auto-select rhyming peers
    if (!newMap.has(index)) {
      // Use the current nextColorId sequence
      const colorId = nextColorId;
      newMap.set(index, colorId);

      // Increment sequence for the NEXT interaction
      setNextColorId((prev) => prev + 1);

      if (dictState.engine) {
        words.forEach((w, i) => {
          if (i === index) return;
          const cleanW = cleanFn(w);
          // Auto-select rhymes with the SAME colorId
          if (dictState.engine!.checkRhyme(targetWord, cleanW)) {
            // Only overwrite if not already selected? 
            // The requirement says "highlight them". 
            // If another rhyme is already highlighted a different color, do we overwrite?
            // "expecting all being the same [color]" implies groupings.
            // Let's overwrite to ensure this group is unified.
            newMap.set(i, colorId);
          }
        });
      }
    } else {
      // Deselecting: just remove the specific word to allow fine-tuning
      newMap.delete(index);
    }
    setWordColors(newMap);
  };

  const outputRhymeMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!dictState.engine || inspirationLines.length === 0) return map;

    const cleanFn = (w: string) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();

    // Get all unique words from output
    const allWords = new Set<string>();
    inspirationLines.forEach(line => {
      line.split(/\s+/).forEach(w => {
        const c = cleanFn(w);
        if (c) allWords.add(c);
      });
    });

    const uniqueWords = Array.from(allWords);
    const assignedWords = new Set<string>();

    // Pass 1: Match against User Inputs (Primary Highlighting)
    const inputWords = inspirationText.trim().split(/\s+/);

    // Pre-calculate input targets
    const inputTargets: { clean: string, colorId: number }[] = [];
    Array.from(wordColors.entries()).forEach(([idx, colorId]) => {
      const w = inputWords[idx];
      if (w) inputTargets.push({ clean: cleanFn(w), colorId });
    });

    uniqueWords.forEach(outWord => {
      // Check primary matches
      for (const { clean: inWord, colorId } of inputTargets) {
        // EXACT MATCH (case insensitive) is primary
        if (outWord === inWord) {
          map.set(outWord, colorId);
          assignedWords.add(outWord);
          break;
        }
        // RHYME MATCH is also primary
        if (dictState.engine!.checkRhyme(inWord, outWord)) {
          map.set(outWord, colorId);
          assignedWords.add(outWord);
          break;
        }
      }
    });

    // Pass 2: Internal Secondary Rhymes
    // We need to find groups within the REMAINING words
    const remaining = uniqueWords.filter(w => !assignedWords.has(w));

    // Start assigning new colors.
    // We use a local counter starting from nextColorId.
    let localColorId = nextColorId;

    // Naive clustering: O(N^2)
    const visited = new Set<string>();

    remaining.forEach((w1) => {
      if (visited.has(w1)) return;

      const group: string[] = [w1];

      // Find all rhymes for w1 in remaining
      remaining.forEach(w2 => {
        if (w1 === w2) return;
        if (visited.has(w2)) return;

        if (dictState.engine!.checkRhyme(w1, w2)) {
          group.push(w2);
        }
      });

      // Only color if it's a rhyming PAIR or more
      if (group.length > 1) {
        const colorId = localColorId++;
        group.forEach(gWord => {
          map.set(gWord, colorId);
          visited.add(gWord);
        });
      }
    });

    return map;
  }, [inspirationLines, wordColors, dictState.engine, nextColorId, inspirationText]);

  const handleGenerateInspiration = async () => {
    if (!inspirationText.trim()) return;
    setIsGenerating(true);
    setInspirationLines([]);

    // Determine targets from highlighted words
    let activeTargets: string[] = [];
    if (wordColors.size > 0) {
      const words = inspirationText.trim().split(/\s+/);
      activeTargets = Array.from(wordColors.keys())
        .map(i => words[i])
        .filter(Boolean)
        .map(w => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")); // Clean punctuation
    } else {
      // Fallback or use all? Let's use all distinct words if none highlighted? 
      // User said "Highlight words you want to rhyme". If none, maybe user implies "all" or specific logic?
      // Let's assume if none highlighted, we treat the whole sentence as context but maybe infer targets.
      // For now, let's pass empty targets and let service handle it, or stick to previous logic.
      // Actually, let's just use the 'targets' state if populated, else empty.
      activeTargets = targets;
    }

    // Get candidates to seed the "mock" LLM (optional, but good for hybrid approach)
    // For MVP we just pass the first result set's candidates if available
    const seedCandidates = resultSets.length > 0 ? resultSets[0].candidates : [];

    const res = await inspirationService.current.generate({
      context: inspirationText,
      targets: activeTargets,
      rhymeCandidates: seedCandidates
    });

    setInspirationLines(res.lines);
    setIsGenerating(false);
  };

  // Loading Animation State
  const [loadingDots, setLoadingDots] = useState('');

  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
    } else {
      setLoadingDots('');
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Helper to highlight targets in the inspiration text area
  // Note: For a true "content editable" where highlighting stays while typing, we'd need a more complex component.
  // For this MVP, we will use a simple textarea for input, and maybe a "preview" of the highlighting, 
  // OR just assume the user understands the context. 
  // Per user request: "search box becomes an editable line of text... and the 'rhyme terms' are the ones highlighted."
  // To achieve this cleanly in React without a heavy RTE library, we can overlay a highlighted div behind a transparent textarea.
  // Removed renderHighlightedText as we use a new UI approach

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center py-10 px-4 font-mono text-slate-200">
      <header className="w-full max-w-6xl mb-8 flex justify-between items-baseline border-b-2 border-slate-700 pb-2">
        <h1 className="text-xl font-bold text-slate-100 flex items-baseline gap-3">
          Rhyme Engine
          <span className="text-xs font-normal text-slate-500">by Parthiv and Gemini</span>
        </h1>
        <div className="flex items-center gap-4">
          {/* Mode Switch */}
          <div className="flex items-center text-xs font-bold text-slate-400 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setInspirationMode(false)}
              className={`px-3 py-1 rounded ${!inspirationMode ? 'bg-slate-600 text-white' : 'hover:text-slate-200'}`}
            >
              CLASSIC
            </button>
            <button
              onClick={() => setInspirationMode(true)}
              className={`px-3 py-1 rounded ${inspirationMode ? 'bg-indigo-600 text-white shadow-lg' : 'hover:text-slate-200'}`}
            >
              INSPIRATION
            </button>
          </div>
          <div className="text-sm text-slate-400">v0.1.2</div>
        </div>
      </header>

      {/* Loading State */}
      {dictState.loading && (
        <div className="flex items-center space-x-2 text-slate-500 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span>Loading dictionary (approx 10MB)...</span>
        </div>
      )}

      {/* Error State */}
      {dictState.error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200">
          <strong>Error:</strong> {dictState.error}
        </div>
      )}

      {/* Main Interface */}
      {!dictState.loading && !dictState.error && (
        <div className="w-full max-w-6xl border-2 border-slate-700 flex flex-col h-[80vh]">

          {/* Top Control Area */}
          <div className="p-6 border-b-2 border-slate-700 bg-slate-900 shrink-0 flex flex-col gap-4">

            {/* INSPIRATION MODE INPUT */}
            {inspirationMode ? (
              <div className="flex-1 min-w-0 w-full animate-in fade-in duration-500">
                {!isHighlighting ? (
                  /* Step 1: Input */
                  <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                    <p className="text-slate-400 font-mono text-lg">
                      Enter a line to rhyme, and hit enter (e.g. the quick brown fox).
                    </p>
                    <div className="relative w-full">
                      <AutoScalingInput
                        value={inspirationText}
                        onChange={setInspirationText}
                        onEnter={() => setIsHighlighting(true)}
                      />
                    </div>
                    <div className="text-sm text-slate-500">
                      Hit <span className="text-slate-300 font-bold">Enter</span> to highlight words.
                    </div>
                  </div>
                ) : (
                  /* Step 2: Highlight */
                  <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-end">
                      <p className="text-slate-400 font-mono text-sm">
                        Highlight words you want to rhyme.
                      </p>
                      <button
                        onClick={() => setIsHighlighting(false)}
                        className="text-xs text-slate-600 hover:text-slate-400 uppercase tracking-widest"
                      >
                        Restart
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-3 text-3xl font-mono leading-relaxed">
                      {inspirationText.trim().split(/\s+/).map((word, i) => {
                        const hasColor = wordColors.has(i);
                        const displayColorId = wordColors.get(i) || 0;
                        const colorClass = hasColor
                          ? HIGHLIGHT_COLORS[displayColorId % HIGHLIGHT_COLORS.length]
                          : 'text-slate-500 hover:text-slate-300';

                        return (
                          <span
                            key={i}
                            onClick={() => toggleHighlightIndex(i)}
                            className={`cursor-pointer transition-all duration-200 px-2 rounded-md ${colorClass} ${hasColor ? 'scale-105 font-bold shadow-lg' : ''}`}
                          >
                            {word}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleGenerateInspiration}
                        disabled={isGenerating}
                        className="w-12 h-12 flex items-center justify-center rounded-full bg-transparent text-slate-500 hover:text-slate-100 hover:border hover:border-slate-500 hover:bg-slate-800/50 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="GO"
                      >
                        {isGenerating ? '...' : 'GO'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* CLASSIC MODE INPUT */
              <div className="flex flex-col-reverse md:flex-row gap-6">
                <div className="flex-1 min-w-0 w-full md:w-auto">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {targets.map(t => (
                      <span key={t} className="inline-flex items-center px-3 py-1 text-sm font-medium bg-slate-800 text-slate-200 border border-slate-600">
                        {t}
                        <button onClick={() => removeTarget(t)} className="ml-2 text-slate-400 hover:text-white">
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

                  <input
                    type="text"
                    className="w-full text-lg px-4 py-3 bg-slate-800 text-slate-100 border-2 border-slate-700 focus:outline-none focus:border-slate-400 transition-colors placeholder-slate-500"
                    placeholder="Type a word and hit Enter (e.g. 'cat', 'bat')"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-2 ml-1">
                    Add multiple words to see separate lists of rhymes for each.
                  </p>
                </div>

                {/* Info Box (was placeholder) */}
                <div className="hidden md:flex flex-col justify-center text-right text-slate-500 text-sm w-1/3">
                  <p>Switch to <strong>Inspiration Mode</strong> to generate full rhyming lines using AI.</p>
                </div>
              </div>
            )}
          </div>

          {/* Visualization / Results Area */}
          <div className="overflow-x-auto overflow-y-hidden flex-1 p-2 flex flex-col min-h-0 bg-slate-900/50">

            {inspirationMode ? (
              /* INSPIRATION RESULTS */
              <div className="h-full w-full flex flex-col items-center p-8 overflow-y-auto no-scrollbar">
                {isGenerating && (
                  <div className="flex flex-col items-center gap-4 mt-24 opacity-70">
                    <div className="text-slate-400 font-mono text-sm tracking-widest animate-pulse">
                      AWAITING RESPONSE{loadingDots}
                    </div>
                  </div>
                )}

                {!isGenerating && inspirationLines.length > 0 && (
                  <div className="w-full max-w-4xl space-y-6 mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {inspirationLines.map((line, idx) => (
                      <div key={idx} className="flex gap-6 items-baseline group w-full">
                        <span className="text-xs text-slate-700 pt-2 font-mono shrink-0 select-none">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <p className="text-2xl text-slate-300 font-mono leading-relaxed hover:text-white transition-colors cursor-text selection:bg-pink-500/30 break-words w-full">
                          {line.split(/\s+/).map((word, wIdx) => {
                            // Highlighting Logic
                            const cleanFn = (w: string) => w.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();
                            const cleanOut = cleanFn(word);

                            const matchId = outputRhymeMap.get(cleanOut);
                            const matchedColorId = matchId !== undefined ? matchId : -1;

                            const colorClass = matchedColorId !== -1
                              ? HIGHLIGHT_COLORS[matchedColorId % HIGHLIGHT_COLORS.length]
                              : '';

                            return (
                              <>
                                <span key={wIdx} className={`${colorClass} ${matchedColorId !== -1 ? 'rounded-md px-1 -mx-1 transition-colors box-decoration-clone' : ''}`}>
                                  {word}
                                </span>{' '}
                              </>
                            );
                          })}
                        </p>
                      </div>
                    ))}
                    <div className="pt-12 text-center text-slate-600 text-xs uppercase tracking-widest">
                      End of suggestions
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* CLASSIC RESULTS */
              <>
                {resultSets.length === 0 && targets.length > 0 && (
                  <div className="p-10 text-center text-slate-400">
                    No rhymes found. Try simpler words?
                  </div>
                )}

                {resultSets.length === 0 && targets.length === 0 && (
                  <div className="p-10 text-center text-slate-300 italic">
                    Waiting for input...
                  </div>
                )}

                <div className={`
                    h-full
                    ${resultSets.length === 1 ? 'w-full' : 'flex gap-4'}
                  `}>
                  {resultSets.map((set) => (
                    <div
                      key={set.target}
                      className={`
                          flex flex-col h-full min-h-0
                          ${resultSets.length === 1 ? 'w-full' : 'w-80 min-w-[300px] border-r last:border-r-0 border-slate-100 pr-2'}
                        `}
                    >
                      {/* Column Header only if multiple */}
                      {resultSets.length > 1 && (
                        <div className="mb-2 px-1 text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 pb-1">
                          Rhymes for "{set.target}"
                        </div>
                      )}

                      <div className="flex-1 min-h-0">
                        <RhymeResultList
                          candidates={set.candidates}
                          layout={resultSets.length === 1 ? 'grid' : 'list'}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>

          {/* Footer Stats */}
          <div className="px-6 py-2 bg-slate-900 border-t-2 border-slate-700 text-xs text-slate-500 flex justify-between">
            <span>Lexicon: {Object.keys(dictState.engine?.['lexicon'] || {}).length.toLocaleString()} words</span>
            <span>{inspirationMode ? 'Mode: Creative (AI)' : 'Mode: Strict (Engine)'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
