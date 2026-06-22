export type EmbeddingProvider = 'openai' | 'ollama' | 'cohere';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  batchSize?: number;
  maxTokens?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  provider: EmbeddingProvider;
  model: string;
}

export interface ChunkData {
  id: string;
  content: string;
  fileId: string;
  chunkIndex: number;
}

const DEFAULT_MAX_TOKENS = 8000;
const EMBEDDING_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  'nomic-embed-text': 768,
  'embed-english-v3.0': 1024,
  'embed-english-v3.0': 1024,
};

function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function chunkText(text: string, maxTokens: number = DEFAULT_MAX_TOKENS): string[] {
  const tokens = countTokens(text);
  if (tokens <= maxTokens) {
    return [text];
  }
  
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const line of lines) {
    const lineTokens = countTokens(line);
    
    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      currentTokens = 0;
    }
    
    currentChunk += line + '\n';
    currentTokens += lineTokens;
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export class OpenAIEmbedder {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  
  constructor(apiKey: string, model: string = 'text-embedding-3-small', baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }
  
  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      results.push({
        embedding: data.data[0].embedding,
        tokenCount: data.usage.prompt_tokens,
        provider: 'openai',
        model: this.model,
      });
    }
    
    return results;
  }
}

export class OllamaEmbedder {
  private baseUrl: string;
  private model: string;
  
  constructor(model: string = 'nomic-embed-text', baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = model;
  }
  
  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      results.push({
        embedding: data.embedding,
        tokenCount: countTokens(text),
        provider: 'ollama',
        model: this.model,
      });
    }
    
    return results;
  }
}

export class CohereEmbedder {
  private apiKey: string;
  private model: string;
  
  constructor(apiKey: string, model: string = 'embed-english-v3.0') {
    this.apiKey = apiKey;
    this.model = model;
  }
  
  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        texts,
        model: this.model,
        input_type: 'search_document',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    return data.embeddings.map((embedding: number[], index: number) => ({
      embedding,
      tokenCount: countTokens(texts[index]),
      provider: 'cohere' as const,
      model: this.model,
    }));
  }
}

export class Embedder {
  private provider: EmbeddingProvider;
  private embedder: OpenAIEmbedder | OllamaEmbedder | CohereEmbedder;
  private maxTokens: number;
  private batchSize: number;
  
  constructor(config: EmbeddingConfig) {
    this.provider = config.provider;
    this.maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
    this.batchSize = config.batchSize || 100;
    
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required');
        }
        this.embedder = new OpenAIEmbedder(config.apiKey, config.model, config.baseUrl);
        break;
      case 'ollama':
        this.embedder = new OllamaEmbedder(config.model, config.baseUrl);
        break;
      case 'cohere':
        if (!config.apiKey) {
          throw new Error('Cohere API key is required');
        }
        this.embedder = new CohereEmbedder(config.apiKey, config.model);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
  
  async embedChunk(content: string): Promise<EmbeddingResult> {
    const chunks = chunkText(content, this.maxTokens);
    if (chunks.length === 1) {
      const results = await this.embedder.embed(chunks);
      return results[0];
    }
    
    const avgEmbedding: number[] = [];
    let totalTokens = 0;
    
    for (const chunk of chunks) {
      const results = await this.embedder.embed([chunk]);
      const result = results[0];
      
      if (avgEmbedding.length === 0) {
        avgEmbedding.push(...result.embedding);
      } else {
        for (let i = 0; i < avgEmbedding.length; i++) {
          avgEmbedding[i] += result.embedding[i];
        }
      }
      totalTokens += result.tokenCount;
    }
    
    const dim = avgEmbedding.length;
    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] /= chunks.length;
    }
    
    const magnitude = Math.sqrt(avgEmbedding.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] /= magnitude;
    }
    
    return {
      embedding: avgEmbedding,
      tokenCount: totalTokens,
      provider: this.provider,
      model: chunks.length > 1 ? `${this.embedder['model']} (averaged)` : this.embedder['model'],
    };
  }
  
  async embedChunks(contents: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < contents.length; i += this.batchSize) {
      const batch = contents.slice(i, i + this.batchSize);
      
      const allChunks: string[] = [];
      const chunkIndices: number[] = [];
      
      for (let j = 0; j < batch.length; j++) {
        const chunks = chunkText(batch[j], this.maxTokens);
        for (let k = 0; k < chunks.length; k++) {
          allChunks.push(chunks[k]);
          chunkIndices.push(j);
        }
      }
      
      let batchEmbeddings: number[][];
      
      if (this.provider === 'cohere') {
        const response = await this.embedder.embed(allChunks);
        batchEmbeddings = response.map(r => r.embedding);
      } else {
        const response = await this.embedder.embed(allChunks);
        batchEmbeddings = response.map(r => r.embedding);
      }
      
      const contentEmbeddings: Map<number, number[]> = new Map();
      const contentTokens: Map<number, number> = new Map();
      
      for (let j = 0; j < allChunks.length; j++) {
        const contentIdx = chunkIndices[j];
        if (!contentEmbeddings.has(contentIdx)) {
          contentEmbeddings.set(contentIdx, []);
          contentTokens.set(contentIdx, 0);
        }
        
        const emb = contentEmbeddings.get(contentIdx)!;
        const existing = emb.length;
        
        if (existing === 0) {
          emb.push(...batchEmbeddings[j]);
        } else {
          for (let k = 0; k < emb.length; k++) {
            emb[k] += batchEmbeddings[j][k];
          }
        }
        
        contentTokens.set(contentIdx, contentTokens.get(contentIdx)! + countTokens(allChunks[j]));
      }
      
      for (const [idx, emb] of contentEmbeddings) {
        const magnitude = Math.sqrt(emb.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
          for (let k = 0; k < emb.length; k++) {
            emb[k] /= magnitude;
          }
        }
        
        const avgCount = allChunks.filter((_, j) => chunkIndices[j] === idx).length;
        
        results.push({
          embedding: emb,
          tokenCount: contentTokens.get(idx)!,
          provider: this.provider,
          model: avgCount > 1 ? `${this.embedder['model']} (averaged)` : this.embedder['model'],
        });
      }
    }
    
    return results;
  }
  
  getDimensions(): number {
    const model = this.embedder['model'] as string;
    return EMBEDDING_DIMENSIONS[model] || 1536;
  }
  
  getProvider(): EmbeddingProvider {
    return this.provider;
  }
}

export function createEmbedder(config: EmbeddingConfig): Embedder {
  return new Embedder(config);
}
