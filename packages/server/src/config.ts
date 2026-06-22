import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  port: parseInt(process.env.CODEPOP_PORT || '8080', 10),
  host: process.env.CODEPOP_HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
  databaseUrl: process.env.DATABASE_URL || '',
  databaseType: (process.env.DATABASE_TYPE as 'postgresql' | 'sqlite' | 'mock') || 'sqlite',
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  embeddingDim: parseInt(process.env.EMBEDDING_DIM || '1536', 10),
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama2',
  cohereApiKey: process.env.COHERE_API_KEY,
};

export const API_KEY_REQUIRED = CONFIG.apiKeyRequired;

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (CONFIG.logLevel === 'debug' || CONFIG.logLevel === 'info') {
      console.log(`[${new Date().toISOString()}] INFO: ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (CONFIG.logLevel !== 'error') {
      console.warn(`[${new Date().toISOString()}] WARN: ${message}`, ...args);
    }
  },
  debug: (message: string, ...args: unknown[]) => {
    if (CONFIG.logLevel === 'debug') {
      console.log(`[${new Date().toISOString()}] DEBUG: ${message}`, ...args);
    }
  },
};
