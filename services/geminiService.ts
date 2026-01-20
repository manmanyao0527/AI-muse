
import { GoogleGenAI } from "@google/genai";

export class AIService {
  private static instance: AIService;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  // Use property access for response.text as per guidelines
  async generateText(prompt: string, model: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  }

  // Refined image generation with support for context/edits
  async generateImage(prompt: string, model: string, aspectRatio: string = '1:1', previousImageUrl?: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [{ text: prompt }];

    // If a previous image exists, add it as context for refinement
    if (previousImageUrl && previousImageUrl.startsWith('data:')) {
      const base64Data = previousImageUrl.split(',')[1];
      const mimeType = previousImageUrl.split(';')[0].split(':')[1];
      parts.unshift({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: model || 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: aspectRatio as any }
      }
    });
    
    // Iterate through parts to find image data as per guidelines
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  }

  // Implement video generation using Veo API and operations polling
  async generateVideo(prompt: string, model: string, aspectRatio: string = '16:9') {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let operation = await ai.models.generateVideos({
      model: model || 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio as any
      }
    });

    while (!operation.done) {
      // Poll every 10 seconds for video generation completion
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
      // Append API key when fetching from the download link as per guidelines
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
    return null;
  }
}
