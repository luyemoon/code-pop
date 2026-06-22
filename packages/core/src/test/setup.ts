import { vi } from 'vitest';

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => `test-uuid-${Math.random().toString(36).substring(7)}`),
  },
});

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
