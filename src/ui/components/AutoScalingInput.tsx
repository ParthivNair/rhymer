import { useState, useRef, useLayoutEffect } from 'react';

interface Props {
    value: string;
    onChange: (val: string) => void;
    onEnter: () => void;
    className?: string;
    placeholder?: string;
}

export default function AutoScalingInput({ value, onChange, onEnter, className, placeholder = "..." }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [fontSize, setFontSize] = useState(30); // Start with 30px (text-3xl approx)

    useLayoutEffect(() => {
        if (!containerRef.current || !measureRef.current) return;

        const containerWidth = containerRef.current.clientWidth;
        const textWidth = measureRef.current.offsetWidth;

        // Add some buffer to prevent jitter at edges
        const buffer = 20;
        const availableWidth = containerWidth - buffer;

        if (textWidth > availableWidth) {
            // Scale down
            const scale = availableWidth / textWidth;
            const newSize = Math.max(12, 30 * scale); // Don't go below 12px
            setFontSize(newSize);
        } else {
            // Reset to max if it fits
            // But we need to check if 'base size' fits.
            // If we are currently small, 'textWidth' will be small.
            // We need to measure what the width WOULD be at max size.
            // So the span should ALWAYS be rendered at max size for measurement?
            // Yes, measureRef should have fixed font-size '30px'.
            setFontSize(30);
        }
    }, [value]);

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {/* 
        Hidden measurement span. 
        CRITICAL: Must match the input's font family/weight/spacing exactly 
        but keep font-size fixed at the base size (30px/1.875rem) to calculate scale ratio consistently.
      */}
            <span
                ref={measureRef}
                className="absolute opacity-0 pointer-events-none whitespace-pre font-mono text-3xl font-normal"
                aria-hidden="true"
            >
                {value || placeholder}
            </span>

            <input
                autoFocus
                type="text"
                className="w-full bg-transparent font-mono text-white placeholder-slate-700 focus:outline-none py-2 caret-pink-500 transition-all duration-100 ease-out"
                style={{ fontSize: `${fontSize}px` }}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && value.trim()) onEnter();
                }}
            />
        </div>
    );
}
