
export function isVowel(phoneme: string): boolean {
    return /[0-9]/.test(phoneme);
}

export function getPerfectRhymeKey(phonemes: string[]): string | null {
    let lastVowelIdx = -1;
    for (let i = phonemes.length - 1; i >= 0; i--) {
        if (isVowel(phonemes[i])) {
            lastVowelIdx = i;
            break;
        }
    }
    if (lastVowelIdx === -1) return null;
    return phonemes.slice(lastVowelIdx).join(' ');
}

export function levenshtein(s: string, t: string): number {
    if (s === t) return 0;
    const n = s.length;
    const m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;

    let v0 = new Int32Array(m + 1);
    let v1 = new Int32Array(m + 1);

    for (let i = 0; i <= m; i++) {
        v0[i] = i;
    }

    for (let i = 0; i < n; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < m; j++) {
            const cost = s[i] === t[j] ? 0 : 1;
            v1[j + 1] = Math.min(
                v1[j] + 1,       // deletion
                v0[j + 1] + 1,   // insertion
                v0[j] + cost     // substitution
            );
        }
        const temp = v0;
        v0 = v1;
        v1 = temp;
    }

    return v0[m];
}
