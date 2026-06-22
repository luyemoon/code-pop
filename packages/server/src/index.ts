import express, { Express, Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { DatabaseAdapter, initAdapters, AdapterFactory, DatabaseConfig } from '@codepop/core';
import { CONFIG, logger } from './config';
import { applyCors } from './middleware/cors';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { getHealthRouter } from './routes/health';
import { getReposRouter, setReposDependencies } from './routes/repos';
import { getSearchRouter, setSearchDependencies } from './routes/search';
import { getEmbeddingsRouter, setEmbeddingsDependencies } from './routes/embeddings';
import { IndexerService, IndexProgress } from './services/indexer';
import { getEmbeddingService } from './services/embedding';

dotenv.config();

let db: DatabaseAdapter;
let server: http.Server;
let wss: WebSocketServer | null = null;

const clients = new Set<WebSocket>();

const validateEnv = (): void => {
  if (!CONFIG.databaseUrl && CONFIG.databaseType !== 'mock') {
    logger.warn('DATABASE_URL is not set, using default configuration');
  }
};

const createDatabaseConfig = (): DatabaseConfig => {
  if (CONFIG.databaseUrl) {
    if (CONFIG.databaseUrl.startsWith('postgresql://') || CONFIG.databaseUrl.startsWith('postgres://')) {
      return {
        type: 'postgresql',
        connectionString: CONFIG.databaseUrl,
      };
    }
    if (CONFIG.databaseUrl.startsWith('sqlite://') || CONFIG.databaseUrl.startsWith('file:')) {
      return {
        type: 'sqlite',
        connectionString: CONFIG.databaseUrl.replace('sqlite://', ''),
      };
    }
  }

  return {
    type: CONFIG.databaseType,
    connectionString: CONFIG.databaseUrl || ':memory:',
  };
};

const initDatabase = async (): Promise<DatabaseAdapter> => {
  logger.info(`Initializing database: ${CONFIG.databaseType}`);

  await initAdapters();

  const config = createDatabaseConfig();
  const database = await AdapterFactory.create(config);

  await database.connect();

  logger.info('Database connected successfully');

  return database;
};

const createApp = (): Express => {
  const app = express();

  app.use(applyCors);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  app.use('/api/health', getHealthRouter(() => db));

  app.use('/api/repos', authMiddleware, getReposRouter());
  app.use('/api/search', authMiddleware, getSearchRouter());
  app.use('/api/embeddings', authMiddleware, getEmbeddingsRouter());

  app.get('/api', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: 'CodePop API',
        version: '0.1.0',
        endpoints: {
          health: 'GET /api/health',
          repos: {
            list: 'GET /api/repos',
            create: 'POST /api/repos',
            get: 'GET /api/repos/:id',
            update: 'PATCH /api/repos/:id',
            delete: 'DELETE /api/repos/:id',
            index: 'POST /api/repos/:id/index',
            files: 'GET /api/repos/:id/files',
            symbols: 'GET /api/repos/:id/symbols',
          },
          search: {
            semantic: 'POST /api/search',
            symbol: 'POST /api/search/symbol',
            history: 'GET /api/search/history',
          },
          embeddings: {
            byFile: 'GET /api/embeddings/file/:fileId',
            deleteByFile: 'DELETE /api/embeddings/file/:fileId',
            deleteByRepo: 'DELETE /api/embeddings/repo/:repoId',
            get: 'GET /api/embeddings/:id',
            update: 'PATCH /api/embeddings/:id',
          },
        },
      },
    });
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Cannot ${req.method} ${req.path}`,
    });
  });

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
};

const initWebSocket = (server: http.Server): WebSocketServer => {
  const wsServer = new WebSocketServer({ server, path: '/ws' });

  wsServer.on('connection', (ws: WebSocket) => {
    logger.info('WebSocket client connected');
    clients.add(ws);

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        logger.debug('WebSocket message received:', data);

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        logger.warn('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });

    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Connected to CodePop WebSocket server',
    }));
  });

  wsServer.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  logger.info('WebSocket server initialized');

  return wsServer;
};

const notifyClients = (message: object): void => {
  const payload = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

const startServer = async (): Promise<void> => {
  validateEnv();

  try {
    db = await initDatabase();

    setReposDependencies(db, wss);
    setSearchDependencies(db);
    setEmbeddingsDependencies(db);

    const app = createApp();

    server = http.createServer(app);

    wss = initWebSocket(server);

    server.listen(CONFIG.port, CONFIG.host, () => {
      logger.info(`CodePop server running on http://${CONFIG.host}:${CONFIG.port}`);
      logger.info(`WebSocket server running on ws://${CONFIG.host}:${CONFIG.port}/ws`);
      logger.info(`Database type: ${CONFIG.databaseType}`);
      logger.info(`API key required: ${CONFIG.apiKeyRequired}`);
    });

    server.on('error', (error: Error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error closing server:', err);
      } else {
        logger.info('HTTP server closed');
      }
    });
  }

  if (wss) {
    wss.close(() => {
      logger.info('WebSocket server closed');
    });
  }

  if (db) {
    try {
      await db.disconnect();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting database:', error);
    }
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

startServer();

export { app, db, server, wss };
