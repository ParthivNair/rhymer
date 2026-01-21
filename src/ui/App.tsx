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

        const [lexicon, perfectIndex, tailIndex] = await Promise.all([
          fetchResource('lexicon.json'),
          fetchResource('index_perfect.json'),
          fetchResource('index_tail.json'),
        ]) as [Lexicon, PerfectIndex, TailIndex];

        const engine = new RhymeEngine(lexicon, perfectIndex, tailIndex);
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Rhyme Engine <span className="text-blue-600">v0</span>
        </h1>
        <p className="text-slate-500 max-w-md mx-auto">
          Deterministic multi-word rhyme finder. Running entirely in your browser.
        </p>
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
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl border border-slate-100 overflow-hidden flex flex-col h-[85vh]">
          {/* Input Area */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex flex-wrap gap-2 mb-3">
              {targets.map(t => (
                <span key={t} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  {t}
                  <button onClick={() => removeTarget(t)} className="ml-2 text-blue-400 hover:text-blue-900">
                    &times;
                  </button>
                </span>
              ))}
            </div>

            <input
              type="text"
              className="w-full text-lg px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
              placeholder="Type a word and hit Enter (e.g. 'cat', 'bat')"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-2 ml-1">
              Add multiple words to see separate lists of rhymes for each.
            </p>
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
                    <div className="mb-2 px-1 text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">
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
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
            <span>Lexicon: {Object.keys(dictState.engine?.['lexicon'] || {}).length.toLocaleString()} words</span>
            <span>v0.1.0</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
