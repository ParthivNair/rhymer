import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RhymeEngine } from '../src/engine/index.js'; // Ensure extension if required, but tsx usually handles it. Actually let's try without .js first or rely on earlier fix. Wait, for internal project imports, tsx handles .ts.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ARTIFACTS_DIR = path.join(__dirname, '../public/artifacts');

function loadJSON(name: string) {
    return JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, name), 'utf-8'));
}

async function main() {
    console.log("Loading dictionary...");
    const lexicon = loadJSON('lexicon.json');
    const perfectIndex = loadJSON('index_perfect.json');
    const tailIndex = loadJSON('index_tail.json');

    // Mock freq map for checking
    const freqMap = new Map<string, number>();

    const engine = new RhymeEngine(lexicon, perfectIndex, tailIndex, freqMap);
    console.log("Engine loaded.");

    const testCases = [
        { w1: "CAT", w2: "BAT", expect: true, label: "Perfect Rhyme" },
        { w1: "CAT", w2: "DOG", expect: false, label: "Non-Rhyme" },
        { w1: "MESSAGE", w2: "TESTING", expect: true, label: "Internal Rhyme (Assonance)" },
        { w1: "MESSAGE", w2: "TESTIN", expect: true, label: "Fuzzy + Internal Rhyme" },
        { w1: "TESTING", w2: "TESTIN", expect: true, label: "Fuzzy Self/Variant" },
        { w1: "WALKING", w2: "TALKING", expect: true, label: "Perfect Rhyme (ING)" },
    ];

    let passed = 0;
    for (const test of testCases) {
        const result = engine.checkRhyme(test.w1, test.w2);
        const status = result === test.expect ? "PASS" : "FAIL";
        if (status === "PASS") passed++;
        console.log(`[${status}] ${test.label}: "${test.w1}" vs "${test.w2}" -> ${result}`);
    }

    console.log(`\nResults: ${passed}/${testCases.length} passed.`);
    if (passed === testCases.length) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

main().catch(console.error);
