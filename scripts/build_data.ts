
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const OUT_DIR = path.resolve(process.cwd(), 'public/artifacts');
const INPUT_FILE = path.join(DATA_DIR, 'cmudict-0.7b');

// --- Types ---
interface LexiconEntry {
  p: string[]; // Phonemes
  s: string;   // Stress Pattern
  c: number;   // Syllable Count
}

type Lexicon = Record<string, LexiconEntry>;
type InvertedIndex = Record<string, string[]>;

// --- Helper Functions ---

function isVowel(phoneme: string): boolean {
  return /[0-9]/.test(phoneme);
}

function getStress(phonemes: string[]): string {
  return phonemes
    .filter(isVowel)
    .map(p => p.replace(/[^0-9]/g, ''))
    .join('');
}

function getPerfectRhymeKey(phonemes: string[]): string | null {
  // Find index of last stressed vowel
  // Note: Primary (1) or Secondary (2). 0 is unstressed.
  // Ideally rhyme matches on the last vowel regardless of stress, BUT
  // strict perfect rhyme usually requires the vowel to be stressed (primary or secondary)
  // or it is the only vowel.
  // For MVP, lets take the last vowel that has a number, assuming it carries the rhyme.
  
  // Update: "Last Stressed Vowel + Tail".
  // If we look at "ORANGE" -> AO1 R AH0 N JH. Last vowel is AH0.
  // Does "ORANGE" rhyme with "HINGE" (HH IH1 N JH)? No.
  // "ORANGE" rhymes with... nothing perfectly.
  // "CAT" -> K AE1 T. Last vowel AE1. Key: "AE1 T".
  // "WATER" -> W AO1 T ER0. Last vowel ER0. Key: "ER0". Matches "SLAUGHTER" (S L AO1 T ER0).
  // Yes, so we take the LAST vowel, whatever its stress.
  
  let lastVowelIdx = -1;
  for (let i = phonemes.length - 1; i >= 0; i--) {
    if (isVowel(phonemes[i])) {
      lastVowelIdx = i;
      break;
    }
  }

  if (lastVowelIdx === -1) return null; // No vowels (e.g. "MMM")

  // The rhyme key is the sub-array from lastVowelIdx to end
  return phonemes.slice(lastVowelIdx).join(' ');
}

// --- Main ---

async function build() {
  console.log('Starting build...');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const lexicon: Lexicon = {};
  const perfectIndex: InvertedIndex = {};
  const tailIndex: InvertedIndex = {};

  const fileStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let count = 0;

  for await (const line of rl) {
    if (line.startsWith(';;;')) continue;
    
    // Line format: "WORD  P H O N E M E S"
    // Handle "Word(1)" variants
    const parts = line.split('  ');
    if (parts.length < 2) continue;

    const rawWord = parts[0];
    const phonemeStr = parts[1];
    
    // Normalize word: remove (N) suffix if present
    const isVariant = /\(\d+\)$/.test(rawWord);
    const word = rawWord.replace(/\(\d+\)$/, '');

    // Skip variants for MVP to keep lexicon smaller/simpler, OR include them?
    // If we included them, we'd overwrite.
    // "TOMATO" and "TOMATO(1)" are diff pronunciations.
    // If we skip variants, we lose "either" / "eye-ther".
    // Let's SKIP variants if the word already exists.
    if (isVariant && lexicon[word]) continue;

    const phonemes = phonemeStr.split(' ');
    
    // 1. Build Lexicon Entry
    const stress = getStress(phonemes);
    const entry: LexiconEntry = {
      p: phonemes,
      s: stress,
      c: stress.length
    };
    
    lexicon[word] = entry;

    // 2. Build Perfect Index
    const perfKey = getPerfectRhymeKey(phonemes);
    if (perfKey) {
      if (!perfectIndex[perfKey]) perfectIndex[perfKey] = [];
      perfectIndex[perfKey].push(word);
    }

    // 3. Build Tail Index (Last 2 and Last 3)
    // Only if length implies enough phonemes?
    // "IT" -> IH1 T. Last 2: "IH1 T".
    // "BIT" -> B IH1 T. Last 2: "IH1 T". matches.
    // "RABBIT" -> ... B IH0 T. Last 2 "IH0 T".
    // Near rhymes often rely on strict suffix matching.
    
    const tailLens = [2, 3];
    for (const len of tailLens) {
      if (phonemes.length >= len) {
        const tailKey = phonemes.slice(-len).join(' ');
        if (!tailIndex[tailKey]) tailIndex[tailKey] = [];
        tailIndex[tailKey].push(word);
      }
    }

    count++;
    if (count % 10000 === 0) process.stdout.write(`Processing: ${count} words...\r`);
  }

  console.log(`\nProcessed ${count} words.`);
  
  // Write Artifacts
  console.log('Writing artifacts...');
  
  fs.writeFileSync(path.join(OUT_DIR, 'lexicon.json'), JSON.stringify(lexicon));
  fs.writeFileSync(path.join(OUT_DIR, 'index_perfect.json'), JSON.stringify(perfectIndex));
  fs.writeFileSync(path.join(OUT_DIR, 'index_tail.json'), JSON.stringify(tailIndex));
  
  console.log('Done!');
  
  // Stats
  console.log(`Lexicon Size: ${Object.keys(lexicon).length}`);
  console.log(`Perfect Keys: ${Object.keys(perfectIndex).length}`);
}

build().catch(err => console.error(err));
