import { List } from 'react-window';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Candidate } from '../../engine/types';

interface RhymeResultListProps {
    candidates: Candidate[];
    layout: 'list' | 'grid';
}

interface ListData {
    candidates: Candidate[];
    numColumns: number;
}

const GUTTER_SIZE = 8;
const ITEM_HEIGHT = 68;

// Custom AutoSizer to avoid external dependency issues
const AutoSizer = ({ children }: { children: (size: { width: number; height: number }) => React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!ref.current) return;

        // Initial size
        setSize({
            width: ref.current.offsetWidth,
            height: ref.current.offsetHeight
        });

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 0, flex: 1, overflow: 'hidden' }}>
            {size.width > 0 && size.height > 0 && children(size)}
        </div>
    );
};

// Row component receives candidates and numColumns directly as props now
const Row = ({ index, style, candidates, numColumns }: { index: number; style: CSSProperties } & ListData) => {
    const startIndex = index * numColumns;

    const items = [];
    for (let i = 0; i < numColumns; i++) {
        if (startIndex + i < candidates.length) {
            items.push({
                candidate: candidates[startIndex + i],
                index: startIndex + i
            });
        }
    }

    const rowStyle: CSSProperties = {
        ...style,
        height: Number(style.height) - GUTTER_SIZE,
        width: '100%' // Ensure row takes full width
    };

    return (
        <div style={rowStyle} className="flex gap-2">
            {items.map(({ candidate, index: originalIndex }) => (
                <div
                    key={candidate.word}
                    className="flex-1 flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors group bg-white shadow-sm"
                >
                    <div className="flex items-baseline space-x-2 overflow-hidden">
                        <span className="text-slate-400 text-xs w-6 text-right font-mono shrink-0">{originalIndex + 1}.</span>
                        <span className="font-semibold text-slate-800 text-lg truncate" title={candidate.word}>{candidate.word}</span>
                    </div>

                    <div className="flex flex-col items-end shrink-0 ml-2">
                        <div className="text-xs font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded">
                            {(candidate.totalScore * 100).toFixed(0)}
                        </div>
                    </div>
                </div>
            ))}
            {items.length < numColumns && Array.from({ length: numColumns - items.length }).map((_, i) => (
                <div key={`spacer-${i}`} className="flex-1" />
            ))}
        </div>
    );
};

export default function RhymeResultList({ candidates, layout }: RhymeResultListProps) {
    if (candidates.length === 0) {
        return (
            <div className="text-slate-400 italic text-sm p-4 text-center">
                No rhymes found for this word.
            </div>
        );
    }

    return (
        <div className="h-full w-full min-h-0 flex flex-col">
            <AutoSizer>
                {({ width, height }) => {
                    const numColumns = (layout === 'grid' && width > 600) ? 2 : 1;
                    const rowCount = Math.ceil(candidates.length / numColumns);

                    return (
                        <List<ListData>
                            style={{ width, height }}
                            rowCount={rowCount}
                            rowHeight={ITEM_HEIGHT}
                            rowProps={{ candidates, numColumns }}
                            overscanCount={8}
                            rowComponent={Row}
                        />
                    );
                }}
            </AutoSizer>
        </div>
    );
}
