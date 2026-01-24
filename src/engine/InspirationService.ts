import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Candidate } from './types';

export interface InspirationRequest {
  context: string;
  targets: string[];
  rhymeCandidates: Candidate[];
}

export interface InspirationResponse {
  lines: string[];
}

export class InspirationService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string = import.meta.env.VITE_GOOGLE_GENAI_API_KEY) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  }

  async generate(request: InspirationRequest): Promise<InspirationResponse> {
    const { context, targets } = request;

    // Construct prompt for different pathways
    const prompt = `
      Context: "${context}"
      Rhyme Targets: ${targets.join(', ')}

      You are a creative rhyming assistant. Generate 3 distinct rhyming options (lines) based on the context.
      
      1. **Continuation**: A line that naturally follows the context and rhymes with the targets (or fits the scheme).
      2. **Bridge**: A line that connects the current thought to a new rhyme scheme or topic.
      3. **Twist**: A creative or surprising line that still rhymes but offers a different angle.

      Return ONLY a raw JSON array of strings, e.g.:
      ["... line 1 ...", "... line 2 ...", "... line 3 ..."]
      Do not include markdown formatting like \`\`\`json.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean up markdown if present
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const lines = JSON.parse(text);
      if (Array.isArray(lines)) {
        return { lines };
      }
      return { lines: [text] }; // Fallback
    } catch (error) {
      console.error("Gemini API Error:", error);
      return {
        lines: [
          "Error contacting creative mind...",
          "Please check your connection.",
          (error as Error).message
        ]
      };
    }
  }
}
