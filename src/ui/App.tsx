import { useState, useEffect } from 'react';
import { RhymeEngine } from '../engine';
import type { Candidate, Lexicon, PerfectIndex, TailIndex } from '../engine/types';
import RhymeResultList from './components/RhymeResultList';

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
  // Changed results state to hold an array of result sets
  const [resultSets, setResultSets] = useState<{ target: string; candidates: Candidate[] }[]>([]);

  // Load Dictionary on Mount
  useEffect(() => {
    async function loadData() {
      try {
        console.log(`Fetching dictionary from: ${ARTIFACTS_PATH}`);

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
        console.log("Dictionary loaded successfully");

      } catch (err: any) {
        console.error(err);
        setDictState({ loading: false, engine: null, error: err.message || "Unknown error" });
      }
    }

    loadData();
  }, []);

  // Run Comparison when targets change
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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center py-10 px-4 font-mono text-slate-200">
      <header className="w-full max-w-6xl mb-8 flex justify-between items-baseline border-b-2 border-slate-700 pb-2">
        <h1 className="text-xl font-bold text-slate-100 flex items-baseline gap-3">
          Rhyme Engine
          <span className="text-xs font-normal text-slate-500">by Parthiv and Gemini</span>
        </h1>
        <div className="text-sm text-slate-400">
          v0.1.1
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
          {/* Input Area */}
          {/* Input Area */}
          <div className="p-6 border-b-2 border-slate-700 bg-slate-900 shrink-0 flex flex-col-reverse md:flex-row gap-6">
            {/* Left Side: Search */}
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

            {/* Right Side: Inspiration Tool Placeholder */}
            <div className="w-full md:w-1/3 min-w-[250px] h-32 md:h-auto border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-600 font-bold tracking-widest text-sm shrink-0">
              INSPIRATION TOOL HERE
            </div>
          </div>

          {/* Results Area */}
          <div className="overflow-x-auto overflow-y-hidden flex-1 p-2 flex flex-col min-h-0">
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

            {/* 
                   Dynamic Grid Layout 
                   If 1 target -> Virtualized Grid (responsive)
                   If >1 target -> Flex columns, each with Virtualized List
               */}
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
          </div>

          {/* Footer Stats */}
          <div className="px-6 py-2 bg-slate-900 border-t-2 border-slate-700 text-xs text-slate-500 flex justify-between">
            <span>Lexicon: {Object.keys(dictState.engine?.['lexicon'] || {}).length.toLocaleString()} words</span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
