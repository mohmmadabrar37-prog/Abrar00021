export interface ImageTemplate {
  id: string;
  name: string;
  url: string;
  description: string;
  suggestedPrompts: string[];
}

export interface EditHistoryItem {
  id: string;
  imageUrl: string;
  prompt: string;
  timestamp: string;
  textFeedback?: string;
  isInitial?: boolean;
}

export type GenerativeModel = "gemini-2.5-flash-image" | "gemini-3.1-flash-image-preview";

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface ProcessingOptions {
  model: GenerativeModel;
  aspectRatio: AspectRatio;
}
