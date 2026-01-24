import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.VITE_GOOGLE_GENAI_API_KEY || '';

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        const models = (data.models || []).filter((m: any) => m.name.includes('flash'));
        console.log(JSON.stringify(models, null, 2));
    } catch (e) {
        console.error(e);
    }
}

listModels();
