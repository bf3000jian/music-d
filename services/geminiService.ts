import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize safely, assuming the key might be missing during initial dev until injected
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey: apiKey });
}

export const getSmartSearchTerms = async (userPrompt: string): Promise<string[]> => {
  if (!ai) {
    console.error("Gemini API key is missing");
    return [userPrompt];
  }

  try {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a music discovery assistant. 
    The user will describe a mood, a situation, or a vague musical desire.
    Your task is to translate this into 3-5 specific, high-probability search terms that would work in a standard music database.
    These terms can be song titles, specific artists, or very specific genres combined with keywords.
    Avoid generic terms like "sad songs"; prefer "Gloomy Sunday", "Adele", "Radiohead".
    Return ONLY a JSON array of strings.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [userPrompt];
    
    const terms = JSON.parse(jsonText);
    return Array.isArray(terms) ? terms : [userPrompt];

  } catch (error) {
    console.error("Gemini smart search failed:", error);
    return [userPrompt]; // Fallback to raw input
  }
};

export const getMusicTrivia = async (songName: string, artist: string): Promise<string> => {
    if (!ai) return "AI Key missing.";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Tell me a fun, one-sentence trivia fact about the song "${songName}" by ${artist}. Keep it under 20 words.`,
        });
        return response.text || "Enjoy the music!";
    } catch (e) {
        return "Enjoy the music!";
    }
}
