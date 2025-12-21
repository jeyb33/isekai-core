/*
 * Copyright (C) 2025 Isekai
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSessionStore, closeSessionStore } from './session-store.js';

// Mock dependencies
const mockRedisConnect = vi.fn();
const mockRedisQuit = vi.fn();
const mockRedisOn = vi.fn();
const mockPoolEnd = vi.fn();
const mockPoolOn = vi.fn();

vi.mock('ioredis', () => {
  return {
    Redis: class MockRedis {
      connect = mockRedisConnect;
      quit = mockRedisQuit;
      on = mockRedisOn;
    },
  };
});

vi.mock('connect-redis', () => {
  return {
    default: class MockRedisStore {
      client: any;
      constructor(options: any) {
        this.client = options.client;
      }
    },
  };
});

vi.mock('connect-pg-simple', () => ({
  default: vi.fn(() => {
    return class MockPgSession {
      pool: any;
      constructor() {
        this.pool = {
          end: mockPoolEnd,
          on: mockPoolOn,
        };
      }
    };
  }),
}));

vi.mock('pg', () => {
  return {
    Pool: class MockPool {
      end = mockPoolEnd;
      on = mockPoolOn;
    },
  };
});

vi.mock('express-session', () => ({
  default: {},
}));

describe('session-store', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SESSION_STORE;
    delete process.env.REDIS_URL;
    delete process.env.SESSION_STORE_TYPE;
    process.env.DATABASE_URL = 'postgresql://localhost/test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createSessionStore', () => {
    it('should create PostgreSQL store when SESSION_STORE=postgres', async () => {
      process.env.SESSION_STORE = 'postgres';

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(process.env.SESSION_STORE_TYPE).toBe('postgres');
    });

    it('should create PostgreSQL store when SESSION_STORE=postgresql', async () => {
      process.env.SESSION_STORE = 'postgresql';

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(process.env.SESSION_STORE_TYPE).toBe('postgres');
    });

    it('should attempt Redis when SESSION_STORE=redis and succeed', async () => {
      process.env.SESSION_STORE = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      mockRedisConnect.mockResolvedValue(undefined);

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(mockRedisConnect).toHaveBeenCalled();
      expect(process.env.SESSION_STORE_TYPE).toBe('redis');
    });

    it('should fallback to PostgreSQL when SESSION_STORE=redis but Redis fails', async () => {
      process.env.SESSION_STORE = 'redis';
      process.env.REDIS_URL = 'redis://localhost:6379';

      mockRedisConnect.mockRejectedValue(new Error('Connection failed'));

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(process.env.SESSION_STORE_TYPE).toBe('postgres');
    });

    it('should auto-detect and use Redis when available', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      mockRedisConnect.mockResolvedValue(undefined);

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(mockRedisConnect).toHaveBeenCalled();
      expect(process.env.SESSION_STORE_TYPE).toBe('redis');
    });

    it('should fallback to PostgreSQL when Redis auto-detect fails', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      mockRedisConnect.mockRejectedValue(new Error('Connection timeout'));

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(process.env.SESSION_STORE_TYPE).toBe('postgres');
    });

    it('should use PostgreSQL when no REDIS_URL configured', async () => {
      delete process.env.REDIS_URL;

      const store = await createSessionStore();

      expect(store).toBeDefined();
      expect(mockRedisConnect).not.toHaveBeenCalled();
      expect(process.env.SESSION_STORE_TYPE).toBe('postgres');
    });

    it('should handle Redis connection timeout', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      // Simulate timeout by never resolving
      mockRedisConnect.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 10000); // Longer than 5s timeout
          })
      );

      const store = await createSessionStore();

      // Should fallback to PostgreSQL after timeout
      expect(store).toBeDefined();
      expect(process.env.SESSION_STORE_TYPE).toBe('postgres');
    }, 10000);

    it('should attach error handler to Redis client', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      mockRedisConnect.mockResolvedValue(undefined);

      await createSessionStore();

      expect(mockRedisOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should attach error handler to PostgreSQL pool', async () => {
      delete process.env.REDIS_URL;

      await createSessionStore();

      expect(mockPoolOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should throw error when DATABASE_URL missing for PostgreSQL', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.REDIS_URL;

      await expect(createSessionStore()).rejects.toThrow('DATABASE_URL is required');
    });

    it('should handle Redis error event', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let errorHandler: Function;
      mockRedisOn.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      mockRedisConnect.mockResolvedValue(undefined);

      await createSessionStore();

      // Trigger error event
      errorHandler!(new Error('Redis connection lost'));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SessionStore] Error:',
        'Redis connection lost'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle PostgreSQL pool error event', async () => {
      delete process.env.REDIS_URL;

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let errorHandler: Function;
      mockPoolOn.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler;
        }
      });

      await createSessionStore();

      // Trigger error event
      errorHandler!(new Error('Database connection lost'));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SessionStore] Error:',
        'Database connection lost'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('closeSessionStore', () => {
    it('should close Redis client when store has Redis client', async () => {
      const redisStore = {
        client: {
          quit: mockRedisQuit,
        },
      };

      mockRedisQuit.mockResolvedValue('OK');

      await closeSessionStore(redisStore as any);

      expect(mockRedisQuit).toHaveBeenCalled();
    });

    it('should close PostgreSQL pool when store has pool', async () => {
      const pgStore = {
        pool: {
          end: mockPoolEnd,
        },
      };

      mockPoolEnd.mockResolvedValue(undefined);

      await closeSessionStore(pgStore as any);

      expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('should handle stores without client or pool', async () => {
      const emptyStore = {};

      await expect(closeSessionStore(emptyStore as any)).resolves.not.toThrow();
    });

    it('should handle store with client but no quit method', async () => {
      const invalidStore = {
        client: {},
      };

      await expect(closeSessionStore(invalidStore as any)).resolves.not.toThrow();
    });

    it('should handle store with pool but no end method', async () => {
      const invalidStore = {
        pool: {},
      };

      await expect(closeSessionStore(invalidStore as any)).resolves.not.toThrow();
    });

    it('should handle Redis quit errors gracefully', async () => {
      const redisStore = {
        client: {
          quit: vi.fn().mockRejectedValue(new Error('Quit failed')),
        },
      };

      await expect(closeSessionStore(redisStore as any)).rejects.toThrow('Quit failed');
    });

    it('should handle PostgreSQL end errors gracefully', async () => {
      const pgStore = {
        pool: {
          end: vi.fn().mockRejectedValue(new Error('End failed')),
        },
      };

      await expect(closeSessionStore(pgStore as any)).rejects.toThrow('End failed');
    });
  });
});
