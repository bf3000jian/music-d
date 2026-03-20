const apiKey = process.env.API_KEY || '';
export const isGeminiConfigured = Boolean(apiKey);

type GeminiModule = typeof import("@google/genai");
type GeminiClient = InstanceType<GeminiModule["GoogleGenAI"]>;

let geminiModulePromise: Promise<GeminiModule | null> | null = null;
let geminiClientPromise: Promise<GeminiClient | null> | null = null;

const loadGeminiModule = async (): Promise<GeminiModule | null> => {
  if (!isGeminiConfigured) {
    return null;
  }

  if (!geminiModulePromise) {
    geminiModulePromise = import("@google/genai")
      .then((module) => module)
      .catch((error) => {
        console.error("Failed to load Gemini SDK:", error);
        geminiModulePromise = null;
        return null;
      });
  }

  return geminiModulePromise;
};

const getGeminiClient = async (): Promise<GeminiClient | null> => {
  if (!isGeminiConfigured) {
    return null;
  }

  if (!geminiClientPromise) {
    geminiClientPromise = loadGeminiModule().then((module) => {
      if (!module) {
        return null;
      }

      return new module.GoogleGenAI({ apiKey });
    });
  }

  return geminiClientPromise;
};

export const getSmartSearchTerms = async (userPrompt: string): Promise<string[]> => {
  const [ai, gemini] = await Promise.all([getGeminiClient(), loadGeminiModule()]);
  if (!ai || !gemini) {
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
          type: gemini.Type.ARRAY,
          items: { type: gemini.Type.STRING },
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
    const ai = await getGeminiClient();
    if (!ai) return "";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Tell me a fun, one-sentence trivia fact about the song "${songName}" by ${artist}. Keep it under 20 words.`,
        });
        return response.text || "";
    } catch (e) {
        return "";
    }
}
