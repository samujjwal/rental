import { api } from "~/lib/api-client";

export interface GenerateDescriptionParams {
  title: string;
  category?: string;
  city?: string;
  features?: string[];
  amenities?: string[];
  condition?: string;
  basePrice?: number;
}

export interface GenerateDescriptionResult {
  description: string;
  model: string;
  tokens?: number;
}

export const aiApi = {
  async generateDescription(
    params: GenerateDescriptionParams
  ): Promise<GenerateDescriptionResult> {
    return api.post<GenerateDescriptionResult>("/ai/generate-description", params);
  },
};
