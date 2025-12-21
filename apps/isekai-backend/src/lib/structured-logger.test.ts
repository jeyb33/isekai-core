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
import {
  StructuredLogger,
  LogLevel,
  createLogger,
  legacyLog,
  type LogContext,
} from './structured-logger.js';
import type { Job } from 'bullmq';

describe('structured-logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.LOG_LEVEL;

    // Spy on console methods
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('StructuredLogger', () => {
    it('should generate correlation ID if not provided', () => {
      const logger = new StructuredLogger();

      const correlationId = logger.getCorrelationId();

      expect(correlationId).toMatch(/^pub-[a-f0-9]{8}$/);
    });

    it('should use provided correlation ID', () => {
      const logger = new StructuredLogger({ correlationId: 'test-123' });

      expect(logger.getCorrelationId()).toBe('test-123');
    });

    it('should include additional context', () => {
      const logger = new StructuredLogger({
        correlationId: 'test-123',
        userId: 'user-456',
        deviationId: 'dev-789',
      });

      const context = logger.getContext();

      expect(context.userId).toBe('user-456');
      expect(context.deviationId).toBe('dev-789');
    });

    it('should log debug messages', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = new StructuredLogger();

      logger.debug('Debug message', { key: 'value' });

      expect(console.debug).toHaveBeenCalled();
      const logOutput = JSON.parse((console.debug as any).mock.calls[0][0]);

      expect(logOutput.level).toBe('debug');
      expect(logOutput.message).toBe('Debug message');
      expect(logOutput.context.key).toBe('value');
    });

    it('should log info messages', () => {
      const logger = new StructuredLogger();

      logger.info('Info message', { key: 'value' });

      expect(console.log).toHaveBeenCalled();
      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.level).toBe('info');
      expect(logOutput.message).toBe('Info message');
    });

    it('should log warn messages', () => {
      const logger = new StructuredLogger();

      logger.warn('Warning message', { key: 'value' });

      expect(console.warn).toHaveBeenCalled();
      const logOutput = JSON.parse((console.warn as any).mock.calls[0][0]);

      expect(logOutput.level).toBe('warn');
      expect(logOutput.message).toBe('Warning message');
    });

    it('should log error messages', () => {
      const logger = new StructuredLogger();

      logger.error('Error message', new Error('Test error'), { key: 'value' });

      expect(console.error).toHaveBeenCalled();
      const logOutput = JSON.parse((console.error as any).mock.calls[0][0]);

      expect(logOutput.level).toBe('error');
      expect(logOutput.message).toBe('Error message');
      expect(logOutput.error.message).toBe('Test error');
      expect(logOutput.error.stack).toBeDefined();
    });

    it('should log error without error object', () => {
      const logger = new StructuredLogger();

      logger.error('Error message', undefined, { key: 'value' });

      expect(console.error).toHaveBeenCalled();
      const logOutput = JSON.parse((console.error as any).mock.calls[0][0]);

      expect(logOutput.level).toBe('error');
      expect(logOutput.message).toBe('Error message');
      expect(logOutput.context.key).toBe('value');
    });

    it('should respect LOG_LEVEL=debug', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = new StructuredLogger();

      logger.debug('Debug message');
      logger.info('Info message');

      expect(console.debug).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should respect LOG_LEVEL=info and skip debug', () => {
      process.env.LOG_LEVEL = 'info';
      const logger = new StructuredLogger();

      logger.debug('Debug message');
      logger.info('Info message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should respect LOG_LEVEL=warn and skip debug/info', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = new StructuredLogger();

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should respect LOG_LEVEL=error and only log errors', () => {
      process.env.LOG_LEVEL = 'error';
      const logger = new StructuredLogger();

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should default to INFO level when LOG_LEVEL not set', () => {
      delete process.env.LOG_LEVEL;
      const logger = new StructuredLogger();

      logger.debug('Debug message');
      logger.info('Info message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should redact sensitive fields', () => {
      const logger = new StructuredLogger();

      logger.info('Message', {
        password: 'secret123',
        token: 'abc-token',
        accessToken: 'access-token',
        apiKey: 'key-123',
        normalField: 'visible',
      });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.password).toBe('[REDACTED]');
      expect(logOutput.context.token).toBe('[REDACTED]');
      expect(logOutput.context.accessToken).toBe('[REDACTED]');
      expect(logOutput.context.apiKey).toBe('[REDACTED]');
      expect(logOutput.context.normalField).toBe('visible');
    });

    it('should handle Date objects in context', () => {
      const logger = new StructuredLogger();
      const testDate = new Date('2025-01-15T12:00:00Z');

      logger.info('Message', { timestamp: testDate });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.timestamp).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should handle Error objects in context', () => {
      const logger = new StructuredLogger();
      const testError = new Error('Test error');

      logger.info('Message', { err: testError });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.err.message).toBe('Test error');
      expect(logOutput.context.err.stack).toBeDefined();
    });

    it('should truncate large objects', () => {
      const logger = new StructuredLogger();
      const largeObject = { data: 'x'.repeat(2000) };

      logger.info('Message', { large: largeObject });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.large).toMatch(/\[Object too large:/);
    });

    it('should not truncate small objects', () => {
      const logger = new StructuredLogger();
      const smallObject = { name: 'test', value: 123 };

      logger.info('Message', { small: smallObject });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.small).toEqual(smallObject);
    });

    it('should exclude correlationId from context', () => {
      const logger = new StructuredLogger({ correlationId: 'test-123' });

      logger.info('Message', { correlationId: 'test-123', other: 'value' });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.correlationId).toBe('test-123');
      expect(logOutput.context.correlationId).toBeUndefined();
      expect(logOutput.context.other).toBe('value');
    });

    it('should include timestamp in log entry', () => {
      const logger = new StructuredLogger();

      logger.info('Message');

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle error with status code', () => {
      const logger = new StructuredLogger();
      const error: any = new Error('HTTP error');
      error.status = 404;

      logger.error('Request failed', error);

      const logOutput = JSON.parse((console.error as any).mock.calls[0][0]);

      expect(logOutput.error.status).toBe(404);
    });

    it('should handle error with statusCode', () => {
      const logger = new StructuredLogger();
      const error: any = new Error('HTTP error');
      error.statusCode = 500;

      logger.error('Request failed', error);

      const logOutput = JSON.parse((console.error as any).mock.calls[0][0]);

      expect(logOutput.error.status).toBe(500);
    });

    it('should handle error with code', () => {
      const logger = new StructuredLogger();
      const error: any = new Error('DB error');
      error.code = 'ECONNREFUSED';

      logger.error('Connection failed', error);

      const logOutput = JSON.parse((console.error as any).mock.calls[0][0]);

      expect(logOutput.error.code).toBe('ECONNREFUSED');
    });
  });

  describe('createJobLogger', () => {
    it('should create logger with job context', () => {
      const mockJob: Partial<Job> = {
        id: 'job-123',
        data: {
          deviationId: 'dev-456',
          userId: 'user-789',
        },
        attemptsMade: 2,
      };

      const logger = StructuredLogger.createJobLogger(mockJob as Job);

      const context = logger.getContext();

      expect(context.correlationId).toBe('job-job-123');
      expect(context.jobId).toBe('job-123');
      expect(context.deviationId).toBe('dev-456');
      expect(context.userId).toBe('user-789');
      expect(context.attemptNumber).toBe(3); // attemptsMade + 1
    });
  });

  describe('child logger', () => {
    it('should create child logger with merged context', () => {
      const parent = new StructuredLogger({
        correlationId: 'parent-123',
        userId: 'user-456',
      });

      const child = parent.child({ operation: 'upload' });

      const parentContext = parent.getContext();
      const childContext = child.getContext();

      expect(childContext.correlationId).toBe('parent-123');
      expect(childContext.userId).toBe('user-456');
      expect(childContext.operation).toBe('upload');
      expect(parentContext.operation).toBeUndefined();
    });

    it('should allow child to override parent context', () => {
      const parent = new StructuredLogger({
        correlationId: 'parent-123',
        userId: 'user-456',
      });

      const child = parent.child({ userId: 'user-789' });

      expect(child.getContext().userId).toBe('user-789');
    });
  });

  describe('startTimer', () => {
    it('should measure operation duration', () => {
      vi.useFakeTimers();
      const logger = new StructuredLogger();

      const endTimer = logger.startTimer('Test operation');

      vi.advanceTimersByTime(150);
      endTimer();

      expect(console.log).toHaveBeenCalled();
      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.message).toBe('Test operation completed');
      expect(logOutput.context.durationMs).toBeGreaterThanOrEqual(150);

      vi.useRealTimers();
    });
  });

  describe('createLogger', () => {
    it('should create logger with context', () => {
      const logger = createLogger({ userId: 'user-123' });

      expect(logger.getContext().userId).toBe('user-123');
    });

    it('should create logger without context', () => {
      const logger = createLogger();

      expect(logger.getCorrelationId()).toMatch(/^pub-/);
    });
  });

  describe('legacyLog', () => {
    it('should format legacy logs with prefix', () => {
      legacyLog('Worker', 'Processing job', 123);

      expect(console.log).toHaveBeenCalled();
      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.message).toBe('[Worker] Processing job 123');
      expect(logOutput.level).toBe('info');
    });

    it('should handle object arguments', () => {
      legacyLog('Test', 'Data:', { key: 'value' });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.message).toContain('{"key":"value"}');
    });

    it('should handle multiple arguments', () => {
      legacyLog('Test', 'arg1', 'arg2', 'arg3');

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.message).toBe('[Test] arg1 arg2 arg3');
    });
  });

  describe('log output format', () => {
    it('should produce valid JSON', () => {
      const logger = new StructuredLogger();

      logger.info('Test message', { key: 'value' });

      const logOutput = (console.log as any).mock.calls[0][0];

      expect(() => JSON.parse(logOutput)).not.toThrow();
    });

    it('should not include context if empty', () => {
      const logger = new StructuredLogger({ correlationId: 'test-123' });

      logger.info('Message without context');

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context).toBeUndefined();
    });

    it('should separate error from context', () => {
      const logger = new StructuredLogger();

      logger.error('Failed', new Error('Test'), { extra: 'data' });

      const logOutput = JSON.parse((console.error as any).mock.calls[0][0]);

      expect(logOutput.error).toBeDefined();
      expect(logOutput.error.message).toBe('Test');
      expect(logOutput.context.extra).toBe('data');
      expect(logOutput.context.error).toBeUndefined();
    });
  });

  describe('sensitive field detection', () => {
    it('should redact fields with "password" in name', () => {
      const logger = new StructuredLogger();

      logger.info('Message', {
        userPassword: 'secret',
        Password: 'secret',
        old_password: 'secret',
      });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.userPassword).toBe('[REDACTED]');
      expect(logOutput.context.Password).toBe('[REDACTED]');
      expect(logOutput.context.old_password).toBe('[REDACTED]');
    });

    it('should redact fields with "secret" in name', () => {
      const logger = new StructuredLogger();

      logger.info('Message', { clientSecret: 'abc123', SECRET_KEY: 'xyz' });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.clientSecret).toBe('[REDACTED]');
      expect(logOutput.context.SECRET_KEY).toBe('[REDACTED]');
    });

    it('should redact authorization headers', () => {
      const logger = new StructuredLogger();

      logger.info('Message', { Authorization: 'Bearer token' });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.Authorization).toBe('[REDACTED]');
    });

    it('should redact cookie fields', () => {
      const logger = new StructuredLogger();

      logger.info('Message', { cookie: 'session=abc', cookies: ['a', 'b'] });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.cookie).toBe('[REDACTED]');
      expect(logOutput.context.cookies).toBe('[REDACTED]');
    });

    it('should redact session fields', () => {
      const logger = new StructuredLogger();

      logger.info('Message', { sessionId: 'abc123' });

      const logOutput = JSON.parse((console.log as any).mock.calls[0][0]);

      expect(logOutput.context.sessionId).toBe('[REDACTED]');
    });
  });
});
