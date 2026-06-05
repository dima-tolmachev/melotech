import type { OutputSource } from "./generate";
import type { PlatformKey } from "./platforms";

/** A single platform output as returned by the API / stored in history. */
export interface PlatformOutputDTO {
  platform: PlatformKey;
  content: Record<string, unknown>;
  source: OutputSource;
  similarity?: number;
  error?: string;
}

/** A semantically-similar past generation (creative feature). */
export interface SimilarConcept {
  id: string;
  prompt: string;
  platforms: PlatformKey[];
  created_at: string;
  similarity: number;
}

/** Response of POST /api/generate. */
export interface GenerateResponse {
  id: string;
  prompt: string;
  platforms: PlatformKey[];
  created_at: string;
  results: PlatformOutputDTO[];
  /** Past concepts most similar to this one (by prompt embedding). */
  similar: SimilarConcept[];
}

/** A history record (generation + its outputs) from GET /api/generations. */
export interface GenerationRecord {
  id: string;
  prompt: string;
  platforms: PlatformKey[];
  created_at: string;
  outputs: PlatformOutputDTO[];
}
