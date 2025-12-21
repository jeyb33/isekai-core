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

import { Request, Response, NextFunction } from 'express';
import { vi } from 'vitest';

/**
 * Create a mock Express Request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: {},
    query: {},
    params: {},
    body: {},
    session: {} as any,
    user: undefined,
    get: vi.fn((header: string) => {
      return (overrides.headers as any)?.[header.toLowerCase()];
    }),
    ...overrides,
  };
}

/**
 * Create a mock Express Response object
 */
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    locals: {},
  };
  return res;
}

/**
 * Create a mock Express NextFunction
 */
export function createMockNext(): NextFunction {
  return vi.fn();
}
