import { CONFIG, logger } from '../config';

export type EmbeddingProvider = 'openai' | 'cohere' | 'ollama';

export interface EmbeddingResult {
  embedding: number[];
  provider: EmbeddingProvider;
  model: string;
  tokens?: number;
}

export interface EmbeddingChunk {
  content: string;
  index: number;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export class EmbeddingService {
  private provider: EmbeddingProvider;
  private model: string;
  private apiKey?: string;

  constructor(provider?: EmbeddingProvider, model?: string) {
    this.provider = provider || this.detectProvider();
    this.model = model || CONFIG.embeddingModel;
    this.apiKey = CONFIG.openaiApiKey || CONFIG.cohereApiKey;
  }

  private detectProvider(): EmbeddingProvider {
    if (CONFIG.openaiApiKey) {
      return 'openai';
    }
    if (CONFIG.cohereApiKey) {
      return 'cohere';
    }
    return 'ollama';
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const startTime = Date.now();

    switch (this.provider) {
      case 'openai':
        return this.generateOpenAIEmbedding(text, startTime);
      case 'cohere':
        return this.generateCohereEmbedding(text, startTime);
      case 'ollama':
        return this.generateOllamaEmbedding(text, startTime);
      default:
        throw new Error(`Unsupported embedding provider: ${this.provider}`);
    }
  }

  private async generateOpenAIEmbedding(text: string, startTime: number): Promise<EmbeddingResult> {
    if (!CONFIG.openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      usage: { total_tokens: number };
    };

    logger.debug(`OpenAI embedding generated in ${Date.now() - startTime}ms`);

    return {
      embedding: data.data[0].embedding,
      provider: 'openai',
      model: this.model,
      tokens: data.usage.total_tokens,
    };
  }

  private async generateCohereEmbedding(text: string, startTime: number): Promise<EmbeddingResult> {
    if (!CONFIG.cohereApiKey) {
      throw new Error('Cohere API key is not configured');
    }

    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.cohereApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        texts: [text],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      embeddings: number[][];
    };

    logger.debug(`Cohere embedding generated in ${Date.now() - startTime}ms`);

    return {
      embedding: data.embeddings[0],
      provider: 'cohere',
      model: this.model,
    };
  }

  private async generateOllamaEmbedding(text: string, startTime: number): Promise<EmbeddingResult> {
    const response = await fetch(`${CONFIG.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.ollamaModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      embedding: number[];
    };

    logger.debug(`Ollama embedding generated in ${Date.now() - startTime}ms`);

    return {
      embedding: data.embedding,
      provider: 'ollama',
      model: CONFIG.ollamaModel,
    };
  }

  async generateEmbeddingsForChunks(chunks: EmbeddingChunk[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const chunk of chunks) {
      try {
        const result = await this.generateEmbedding(chunk.content);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to generate embedding for chunk ${chunk.index}:`, error);
        throw error;
      }
    }

    return results;
  }

  chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): EmbeddingChunk[] {
    const chunks: EmbeddingChunk[] = [];
    const lines = text.split('\n');
    let currentChunk = '';
    let currentLineIndex = 0;
    let chunkIndex = 0;

    for (const line of lines) {
      if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
        });

        const words = currentChunk.split(' ');
        let overlapContent = '';
        let overlapLength = 0;

        for (let i = words.length - 1; i >= 0 && overlapLength < overlap; i--) {
          const word = words[i] + ' ';
          overlapContent = word + overlapContent;
          overlapLength += word.length;
        }

        currentChunk = overlapContent;
      }

      currentChunk += line + '\n';
      currentLineIndex++;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
      });
    }

    return chunks;
  }

  async searchSimilar(embedding: number[], embeddings: Array<{ id: string; embedding: number[]; content: string }>, limit: number = 10): Promise<Array<{ id: string; content: string; similarity: number }>> {
    const similarities = embeddings.map(item => ({
      id: item.id,
      content: item.content,
      similarity: this.cosineSimilarity(embedding, item.embedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

let embeddingServiceInstance: EmbeddingService | null = null;

export const getEmbeddingService = (): EmbeddingService => {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
};
