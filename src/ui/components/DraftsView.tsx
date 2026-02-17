import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Types matches what we need for the UI
interface DraftItem {
    filename: string;
    title: string;
    hasLyrics: boolean;
    size: number; // in bytes
}

const PASSWORD = "kanyewest";
const BUCKET_NAME = "audio-library";

interface DraftsViewProps {
    onBack: () => void;
}

export default function DraftsView({ onBack }: DraftsViewProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    const [drafts, setDrafts] = useState<DraftItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Active playing state
    const [currentTrack, setCurrentTrack] = useState<DraftItem | null>(null);
    const [lyrics, setLyrics] = useState<string | null>(null);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Audio Ref
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 1. Password Check
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === PASSWORD) {
            setIsAuthenticated(true);
            setError(null);
            fetchDrafts();
        } else {
            setError("Incorrect password");
            setPasswordInput("");
        }
    };

    // 2. Fetch Drafts from Supabase
    const fetchDrafts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

            if (error) {
                console.error('Error fetching drafts:', error);
                throw error;
            }

            if (!data) {
                setDrafts([]);
                return;
            }

            // Filter for audio files
            const audioFiles = data.filter(item =>
                item.name.toLowerCase().endsWith('.wav') ||
                item.name.toLowerCase().endsWith('.mp3')
            );

            // Text files for lyrics
            const textFiles = data.filter(item => item.name.toLowerCase().endsWith('.txt')).map(f => f.name);

            const formattedDrafts: DraftItem[] = audioFiles.map(file => {
                const baseName = file.name.replace(/\.(wav|mp3)$/i, '');
                const potentialLyricsFile = `${baseName}.txt`;
                const hasLyrics = textFiles.includes(potentialLyricsFile);

                return {
                    filename: file.name,
                    title: baseName.replace(/[_-]/g, ' '),
                    hasLyrics,
                    size: file.metadata?.size || 0
                };
            });

            setDrafts(formattedDrafts);

        } catch (err) {
            console.error(err);
            setError("Failed to load drafts from Supabase.");
        } finally {
            setLoading(false);
        }
    };

    // 3. Play Track
    const playTrack = async (draft: DraftItem) => {
        setCurrentTrack(draft);
        setLyrics(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);

        if (audioRef.current) {
            // Get public URL for audio
            const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(draft.filename);

            audioRef.current.src = data.publicUrl;
            try {
                await audioRef.current.play();
            } catch (e) {
                console.warn("Autoplay prevented:", e);
            }
        }

        if (draft.hasLyrics) {
            try {
                const txtName = draft.filename.replace(/\.(wav|mp3)$/i, '.txt');
                // Get public URL for lyrics text file
                const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(txtName);

                const res = await fetch(data.publicUrl);
                if (res.ok) {
                    const text = await res.text();
                    setLyrics(text);
                }
            } catch (e) {
                console.error("Failed to load lyrics", e);
            }
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <h2 className="text-2xl font-bold text-slate-200">Restricted Access</h2>
                <form onSubmit={handleLogin} className="flex flex-col gap-3 w-64">
                    <input
                        type="password"
                        className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        placeholder="Enter Password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors"
                    >
                        Unlock Stash
                    </button>
                </form>
                {error && <div className="text-red-400 text-sm">{error}</div>}
                <button onClick={onBack} className="text-slate-500 hover:text-slate-300 text-sm underline">
                    &larr; Back to Rhyme Engine
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header for Drafts */}
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-700">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    🎵 Drafts Vault
                </h2>
                <div className="flex gap-3">
                    <div className="text-xs text-slate-500 flex items-center">
                        Storage: Supabase
                    </div>
                    <button onClick={onBack} className="text-sm px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 transition-colors">
                        Back to App
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Track List */}
                <div className="w-1/3 min-w-[250px] border-r border-slate-700 pr-4 overflow-y-auto">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Available Tracks</h3>
                    {loading ? (
                        <div className="text-slate-500 italic">Loading from Supabase...</div>
                    ) : drafts.length === 0 ? (
                        <div className="text-slate-500 italic text-sm">
                            {error ? "Error loading drafts." : "No audio files found in library."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {drafts.map(d => (
                                <div
                                    key={d.filename}
                                    onClick={() => playTrack(d)}
                                    className={`
                                p-3 rounded cursor-pointer transition-all border
                                ${currentTrack?.filename === d.filename
                                            ? 'bg-blue-900/40 border-blue-500/50 text-blue-100'
                                            : 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-600 text-slate-300'}
                            `}
                                >
                                    <div className="font-bold text-sm truncate">{d.title}</div>
                                    <div className="text-xs text-slate-500 flex justify-between mt-1">
                                        <span>{(d.size / (1024 * 1024)).toFixed(2)} MB</span>
                                        {d.hasLyrics && <span className="text-green-400">📝 Lyrics</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Player & Lyrics Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {currentTrack ? (
                        <>
                            {/* Custom Player UI */}
                            <div className="flex flex-col gap-3 mb-6">
                                <div className="p-4 rounded-lg border border-slate-700 flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-100">{currentTrack.title}</h3>
                                            <p className="text-slate-400 text-xs font-mono">{currentTrack.filename}</p>
                                        </div>
                                        <div className="text-xs font-mono text-slate-500">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={togglePlay}
                                            className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-600 hover:border-blue-500 hover:text-blue-400 text-slate-300 transition-all"
                                        >
                                            {isPlaying ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                                                </svg>
                                            )}
                                        </button>

                                        <div className="flex-1 h-8 flex items-center group">
                                            <div
                                                className="relative w-full h-1 bg-slate-800 rounded cursor-pointer group-hover:h-1.5 transition-all"
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const percent = (e.clientX - rect.left) / rect.width;
                                                    if (audioRef.current) {
                                                        audioRef.current.currentTime = percent * duration;
                                                    }
                                                }}
                                            >
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-blue-600 rounded"
                                                    style={{ width: `${(currentTime / duration) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <audio
                                    ref={audioRef}
                                    className="hidden"
                                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                    onEnded={() => setIsPlaying(false)}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                />
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col">
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Lyrics / Notes</h3>
                                <div className="border border-slate-700 rounded-lg p-4 flex-1 overflow-y-auto whitespace-pre-wrap text-slate-300 font-sans leading-relaxed">
                                    {lyrics ? lyrics : (
                                        <span className="text-slate-500 italic">
                                            {currentTrack.hasLyrics ? "Loading lyrics..." : "No lyrics file found for this track."}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-600 flex-col gap-2">
                            <div className="text-5xl opacity-20">💿</div>
                            <p>Select a track to start listening</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
