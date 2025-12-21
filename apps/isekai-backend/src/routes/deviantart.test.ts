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

// Mock dependencies - define factory functions
vi.mock('../lib/deviantart.js', () => ({
  refreshTokenIfNeeded: vi.fn(),
}));

vi.mock('../lib/redis-cache.js', () => ({
  RedisCache: {
    getOrFetch: vi.fn(),
  },
  CacheTTL: {
    GALLERY_STRUCTURE: 720, // 12 minutes
    CATEGORY_TREE: 21600, // 6 hours
    USER_PROFILE: 1200, // 20 minutes
  },
}));

vi.mock('../lib/cache-keys.js', () => ({
  CacheKeys: {
    gallery: {
      folders: vi.fn((userId: string) => `gallery:folders:${userId}`),
    },
    category: {
      tree: vi.fn(() => 'category:tree'),
    },
    user: {
      profile: vi.fn((userId: string) => `user:profile:${userId}`),
    },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Now import the router and mocked modules
import { deviantartRouter } from './deviantart.js';
import { refreshTokenIfNeeded } from '../lib/deviantart.js';
import { RedisCache } from '../lib/redis-cache.js';
import { CacheKeys } from '../lib/cache-keys.js';

const mockRefreshTokenIfNeeded = vi.mocked(refreshTokenIfNeeded);
const mockGetOrFetch = vi.mocked(RedisCache.getOrFetch);
const mockCacheKeys = vi.mocked(CacheKeys);

describe('DeviantArt Routes', () => {
  const mockUser = {
    id: 'user-123',
    daUserId: 'da-user-123',
    daUsername: 'testuser',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshTokenIfNeeded.mockResolvedValue('mock-access-token');

    // Suppress console.error and console.log during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  async function callRoute(method: string, path: string, req: any, res: any) {
    const routes = (deviantartRouter as any).stack;
    const route = routes.find(
      (r: any) => r.route?.path === path && r.route?.methods?.[method.toLowerCase()]
    );
    if (!route) throw new Error(`Route not found: ${method} ${path}`);
    const handler = route.route.stack[route.route.stack.length - 1].handle;
    await handler(req, res);
  }

  describe('GET /galleries', () => {
    it('should fetch galleries successfully from cache', async () => {
      const mockGalleries = [
        { folderId: 'gallery-1', name: 'Gallery 1', parentId: null },
        { folderId: 'gallery-2', name: 'Gallery 2', parentId: null },
      ];

      mockGetOrFetch.mockResolvedValue({
        data: { galleries: mockGalleries },
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(mockRefreshTokenIfNeeded).toHaveBeenCalledWith(mockUser);
      expect(mockCacheKeys.gallery.folders).toHaveBeenCalledWith(mockUser.id);
      expect(mockGetOrFetch).toHaveBeenCalledWith(
        'gallery:folders:user-123',
        expect.any(Function),
        720,
        true
      );
      expect(res.json).toHaveBeenCalledWith({ galleries: mockGalleries });
    });

    it('should fetch galleries with pagination when cache miss', async () => {
      const mockResults = [
        { deviationid: 'dev-1', title: 'Deviation 1' },
        { deviationid: 'dev-2', title: 'Deviation 2' },
      ];

      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        return { data: await fetcher() };
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            results: mockResults.slice(0, 1),
            has_more: true,
            next_offset: 24,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            results: mockResults.slice(1),
            has_more: false,
            next_offset: null,
          }),
        });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://www.deviantart.com/api/v1/oauth2/gallery/folders?limit=24&offset=0&mature_content=true',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://www.deviantart.com/api/v1/oauth2/gallery/folders?limit=24&offset=24&mature_content=true',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      );

      expect(res.json).toHaveBeenCalledWith({
        galleries: [
          { folderId: 'dev-1', name: 'Deviation 1', parentId: null },
          { folderId: 'dev-2', name: 'Deviation 2', parentId: null },
        ],
      });
    });

    it('should handle galleries with missing titles', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        return { data: await fetcher() };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [{ id: 'dev-1' }],
          has_more: false,
          next_offset: null,
        }),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.json).toHaveBeenCalledWith({
        galleries: [{ folderId: 'dev-1', name: 'Untitled', parentId: null }],
      });
    });

    it('should stop pagination at safety limit', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        return { data: await fetcher() };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [{ deviationid: 'dev-1', title: 'Test' }],
          has_more: true,
          next_offset: 50001,
        }),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({
        galleries: [{ folderId: 'dev-1', name: 'Test', parentId: null }],
      });
    });

    it('should handle API error with JSON error response', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        await fetcher();
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'invalid_token',
          error_description: 'Token has expired',
        }),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle API error with text response', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        await fetcher();
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('Not JSON')),
        text: vi.fn().mockResolvedValue('Server error'),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle invalid response structure', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        await fetcher();
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: 'structure' }),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle timeout error (AbortError)', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'AbortError';

      mockGetOrFetch.mockRejectedValue(timeoutError);

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request timeout' });
    });

    it('should handle timeout error (TimeoutError)', async () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';

      mockGetOrFetch.mockRejectedValue(timeoutError);

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith({ error: 'Request timeout' });
    });

    it('should handle generic error', async () => {
      mockGetOrFetch.mockRejectedValue(new Error('Network error'));

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/galleries', req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('GET /categories', () => {
    it('should fetch categories successfully from cache', async () => {
      const mockCategories = [
        { path: 'traditional/paintings', name: 'Paintings' },
        { path: 'digital/3d', name: '3D Art' },
      ];

      mockGetOrFetch.mockResolvedValue({
        data: { categories: mockCategories },
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/categories', req, res);

      expect(mockRefreshTokenIfNeeded).toHaveBeenCalledWith(mockUser);
      expect(mockCacheKeys.category.tree).toHaveBeenCalled();
      expect(mockGetOrFetch).toHaveBeenCalledWith(
        'category:tree',
        expect.any(Function),
        21600,
        true
      );
      expect(res.json).toHaveBeenCalledWith({ categories: mockCategories });
    });

    it('should fetch categories from API when cache miss', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        return { data: await fetcher() };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          categories: [
            { catpath: 'traditional/paintings', title: 'Paintings' },
            { catpath: 'digital/3d', title: '3D Art' },
          ],
        }),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/categories', req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.deviantart.com/api/v1/oauth2/browse/categorytree',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      );

      expect(res.json).toHaveBeenCalledWith({
        categories: [
          { path: 'traditional/paintings', name: 'Paintings' },
          { path: 'digital/3d', name: '3D Art' },
        ],
      });
    });

    it('should handle empty categories response', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        return { data: await fetcher() };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/categories', req, res);

      expect(res.json).toHaveBeenCalledWith({ categories: [] });
    });

    it('should handle API error', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        await fetcher();
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/categories', req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch categories' });
    });

    it('should handle generic error with default status', async () => {
      mockGetOrFetch.mockRejectedValue(new Error('Network error'));

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/categories', req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Network error' });
    });
  });

  describe('GET /user', () => {
    it('should fetch user profile successfully from cache', async () => {
      const mockProfile = {
        userId: 'da-user-123',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        type: 'regular',
      };

      mockGetOrFetch.mockResolvedValue({
        data: mockProfile,
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/user', req, res);

      expect(mockRefreshTokenIfNeeded).toHaveBeenCalledWith(mockUser);
      expect(mockCacheKeys.user.profile).toHaveBeenCalledWith(mockUser.id);
      expect(mockGetOrFetch).toHaveBeenCalledWith(
        'user:profile:user-123',
        expect.any(Function),
        1200,
        true
      );
      expect(res.json).toHaveBeenCalledWith(mockProfile);
    });

    it('should fetch user profile from API when cache miss', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        return { data: await fetcher() };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          userid: 'da-user-123',
          username: 'testuser',
          usericon: 'https://example.com/avatar.jpg',
          type: 'regular',
        }),
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/user', req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.deviantart.com/api/v1/oauth2/user/whoami',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      );

      expect(res.json).toHaveBeenCalledWith({
        userId: 'da-user-123',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        type: 'regular',
      });
    });

    it('should handle API error', async () => {
      mockGetOrFetch.mockImplementation(async (_key, fetcher) => {
        await fetcher();
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/user', req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch user' });
    });

    it('should handle generic error with default status', async () => {
      mockGetOrFetch.mockRejectedValue(new Error('Network error'));

      const req = { user: mockUser };
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await callRoute('get', '/user', req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Network error' });
    });
  });
});
