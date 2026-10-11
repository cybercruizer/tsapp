import { GoogleGenAI, Type } from "@google/genai";
import { AnalyzedMetadata } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeImageForMetadata = async (base64Image: string): Promise<AnalyzedMetadata> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: "image/jpeg",
            },
          },
          {
            text: "Analyze this image. Estimate the location (city/country/landmark), estimate the time of day or date if visible (ISO format), and approximate coordinates if the location is specific. Also provide a very short description.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING, description: "Estimated city, country, or landmark name" },
            dateTime: { type: Type.STRING, description: "Estimated date time in ISO format if visible or inferable, otherwise current time" },
            coordinates: { type: Type.STRING, description: "Estimated Latitude, Longitude" },
            description: { type: Type.STRING, description: "Short description of the scene" },
          },
          required: ["location", "description"],
        },
      },
    });

    const text = response.text;
    if (!text) return {};
    
    return JSON.parse(text) as AnalyzedMetadata;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    throw error;
  }
};