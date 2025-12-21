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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock Redis client
const mockRedisCall = vi.fn();
const mockGetClient = vi.fn();

vi.mock('../lib/redis-client.js', () => ({
  RedisClientManager: {
    getClient: mockGetClient,
  },
}));

// Mock express-rate-limit and rate-limit-redis
const mockRateLimit = vi.fn((config: any) => {
  // Return middleware that executes config functions for testing
  return async (req: Request, res: Response, next: NextFunction) => {
    // Execute keyGenerator if present
    if (config.keyGenerator) {
      const key = await config.keyGenerator(req);
      (req as any).__rateLimitKey = key;
    }

    // Execute skip if present
    if (config.skip) {
      const shouldSkip = await config.skip(req, res);
      if (shouldSkip) {
        return next();
      }
    }

    // Execute store.sendCommand if present
    if (config.store?.sendCommand) {
      await config.store.sendCommand('GET', 'test-key');
    }

    next();
  };
});

vi.mock('express-rate-limit', () => ({
  default: mockRateLimit,
}));

vi.mock('rate-limit-redis', () => ({
  default: class MockRedisStore {
    constructor(config: any) {
      // Expose config for testing
      this.sendCommand = config.sendCommand;
      this.prefix = config.prefix;
    }
    sendCommand: any;
    prefix: string;
  },
}));

describe('rate-limit middleware', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_RATE_LIMIT;

    mockGetClient.mockResolvedValue({
      call: mockRedisCall,
    });
    mockRedisCall.mockResolvedValue('OK');

    // Reset modules to get fresh rate limiters
    await vi.resetModules();
  });

  describe('comfyUIUploadLimiter', () => {
    it('should be configured correctly', async () => {
      const { comfyUIUploadLimiter } = await import('./rate-limit.js');

      expect(comfyUIUploadLimiter).toBeDefined();
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000,
          max: 100,
          message: 'Too many upload requests, please try again later',
        })
      );
    });
  });

  describe('apiKeyCreationLimiter', () => {
    it('should be configured correctly', async () => {
      const { apiKeyCreationLimiter } = await import('./rate-limit.js');

      expect(apiKeyCreationLimiter).toBeDefined();
      expect(mockRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 60 * 60 * 1000,
          max: 10,
          message: 'Too many API key creation attempts',
        })
      );
    });
  });

  describe('scheduleRateLimit', () => {
    it('should use user ID as key when authenticated', async () => {
      const { scheduleRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-123' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await scheduleRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).__rateLimitKey).toBe('user-123');
    });

    it('should not set custom key when user is not authenticated', async () => {
      const { scheduleRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: undefined,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await scheduleRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).__rateLimitKey).toBeUndefined();
    });

    it('should call Redis through store sendCommand', async () => {
      const { scheduleRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-123' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await scheduleRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockGetClient).toHaveBeenCalled();
      expect(mockRedisCall).toHaveBeenCalledWith('GET', 'test-key');
    });

    it('should skip rate limiting when DISABLE_RATE_LIMIT is true', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      const { scheduleRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-123' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await scheduleRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should not skip rate limiting when DISABLE_RATE_LIMIT is false', async () => {
      process.env.DISABLE_RATE_LIMIT = 'false';

      const { scheduleRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-123' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await scheduleRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedisCall).toHaveBeenCalled();
    });
  });

  describe('batchRateLimit', () => {
    it('should use user ID as key when authenticated', async () => {
      const { batchRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-456' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await batchRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).__rateLimitKey).toBe('user-456');
    });

    it('should not set custom key when user is not authenticated', async () => {
      const { batchRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: undefined,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await batchRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).__rateLimitKey).toBeUndefined();
    });

    it('should call Redis through store sendCommand', async () => {
      const { batchRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-456' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await batchRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockGetClient).toHaveBeenCalled();
      expect(mockRedisCall).toHaveBeenCalledWith('GET', 'test-key');
    });

    it('should skip rate limiting when DISABLE_RATE_LIMIT is true', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      const { batchRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-456' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await batchRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should not skip rate limiting when DISABLE_RATE_LIMIT is false', async () => {
      process.env.DISABLE_RATE_LIMIT = 'false';

      const { batchRateLimit } = await import('./rate-limit.js');

      const mockReq: Partial<Request> = {
        user: { id: 'user-456' } as any,
      };
      const mockRes: Partial<Response> = {};
      const mockNext = vi.fn();

      await batchRateLimit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRedisCall).toHaveBeenCalled();
    });
  });
});
