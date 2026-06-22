import { Request, Response, NextFunction } from 'express';
import { API_KEY_REQUIRED } from '../config';

const VALID_API_KEYS = new Set<string>();

try {
  const apiKeys = process.env.API_KEYS?.split(',') || [];
  apiKeys.forEach(key => {
    if (key.trim()) {
      VALID_API_KEYS.add(key.trim());
    }
  });
} catch {
  // 环境变量未加载，延迟初始化
}

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  isAuthenticated?: boolean;
}

export const loadApiKeys = (): void => {
  VALID_API_KEYS.clear();
  const apiKeys = process.env.API_KEYS?.split(',') || [];
  apiKeys.forEach(key => {
    if (key.trim()) {
      VALID_API_KEYS.add(key.trim());
    }
  });
};

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!API_KEY_REQUIRED) {
    req.isAuthenticated = true;
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key is required',
      message: 'Please provide a valid API key in the X-API-Key header',
    });
    return;
  }

  if (VALID_API_KEYS.size > 0 && !VALID_API_KEYS.has(apiKey)) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not valid',
    });
    return;
  }

  req.apiKey = apiKey;
  req.isAuthenticated = true;
  next();
};

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey && VALID_API_KEYS.size > 0 && VALID_API_KEYS.has(apiKey)) {
    req.apiKey = apiKey;
    req.isAuthenticated = true;
  } else {
    req.isAuthenticated = false;
  }

  next();
};
