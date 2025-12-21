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
import {
  enrichDeviations,
  type BrowseDeviation,
  type EnrichmentOptions,
} from './metadata-enricher.js';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

import { logger } from './logger.js';

const mockLogger = vi.mocked(logger);
const mockFetch = vi.mocked(global.fetch);

describe('metadata-enricher', () => {
  const mockDeviation: BrowseDeviation = {
    deviationId: 'dev-123',
    title: 'Test Deviation',
    url: 'https://deviantart.com/art/test-123',
    thumbUrl: 'https://images.deviantart.com/thumb.jpg',
    previewUrl: 'https://images.deviantart.com/preview.jpg',
    author: {
      username: 'testartist',
      avatarUrl: 'https://a.deviantart.net/avatars/default.gif',
      userId: 'user-456',
    },
    stats: {
      favourites: 10,
      comments: 5,
    },
    publishedTime: '2024-01-01T00:00:00Z',
    isDownloadable: true,
    isMature: false,
    category: 'digitalart',
    tierAccess: null,
    isExclusive: false,
    isPremium: false,
    printId: null,
  };

  const mockApiResponse = {
    metadata: [
      {
        deviationid: 'dev-123',
        stats: {
          favourites: 100,
          comments: 50,
        },
        author: {
          userid: 'user-456-updated',
          usericon: 'https://a.deviantart.net/avatars/custom.jpg',
        },
        submission: {
          category_path: 'digitalart/paintings',
        },
        tier_access: 'unlocked',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrichDeviations', () => {
    it('should return deviations unchanged when no enrichment requested', async () => {
      const options: EnrichmentOptions = {
        includeStats: false,
        includeAuthorAvatars: false,
        includeTierInfo: false,
      };

      const result = await enrichDeviations([mockDeviation], 'token-123', options);

      expect(result).toEqual([mockDeviation]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should enrich single deviation with stats', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123', {
        includeStats: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].stats).toEqual({
        favourites: 100,
        comments: 50,
      });
    });

    it('should enrich deviation with author avatars', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123', {
        includeAuthorAvatars: true,
      });

      expect(result[0].author.avatarUrl).toBe('https://a.deviantart.net/avatars/custom.jpg');
      expect(result[0].author.userId).toBe('user-456-updated');
    });

    it('should enrich deviation with tier info', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123', {
        includeTierInfo: true,
      });

      expect(result[0].tierAccess).toBe('unlocked');
    });

    it('should enrich deviation with all options enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123', {
        includeStats: true,
        includeAuthorAvatars: true,
        includeTierInfo: true,
      });

      expect(result[0]).toMatchObject({
        stats: { favourites: 100, comments: 50 },
        author: {
          username: 'testartist',
          avatarUrl: 'https://a.deviantart.net/avatars/custom.jpg',
          userId: 'user-456-updated',
        },
        category: 'digitalart/paintings',
        tierAccess: 'unlocked',
      });
    });

    it('should batch process large arrays of deviations', async () => {
      const deviations = Array.from({ length: 150 }, (_, i) => ({
        ...mockDeviation,
        deviationId: `dev-${i}`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ metadata: [] }),
      } as Response);

      await enrichDeviations(deviations, 'token-123', { maxBatchSize: 50 });

      // Should make 3 API calls (150 items / 50 per batch)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should use custom batch size when provided', async () => {
      const deviations = Array.from({ length: 100 }, (_, i) => ({
        ...mockDeviation,
        deviationId: `dev-${i}`,
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ metadata: [] }),
      } as Response);

      await enrichDeviations(deviations, 'token-123', { maxBatchSize: 25 });

      // Should make 4 API calls (100 items / 25 per batch)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should include access token in API request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      await enrichDeviations([mockDeviation], 'token-abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://www.deviantart.com/api/v1/oauth2/deviation/metadata'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-abc123' },
        })
      );
    });

    it('should include correct query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      await enrichDeviations([mockDeviation], 'token-123');

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('ext_stats=true');
      expect(callUrl).toContain('ext_submission=true');
      expect(callUrl).toContain('deviationids%5B%5D=dev-123'); // URL encoded deviationids[]
    });

    it('should handle API failure gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123');

      expect(result).toEqual([mockDeviation]); // Return unenriched
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'DeviantArt metadata enrichment API failed',
        expect.objectContaining({
          status: 500,
          batchSize: 1,
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await enrichDeviations([mockDeviation], 'token-123');

      expect(result).toEqual([mockDeviation]); // Return unenriched
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error enriching deviation batch',
        expect.objectContaining({
          error: 'Network error',
          batchSize: 1,
        })
      );
    });

    it('should handle missing metadata for some deviations', async () => {
      const deviations = [
        { ...mockDeviation, deviationId: 'dev-1' },
        { ...mockDeviation, deviationId: 'dev-2' },
        { ...mockDeviation, deviationId: 'dev-3' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          metadata: [
            {
              deviationid: 'dev-1',
              stats: { favourites: 100, comments: 50 },
            },
            // dev-2 missing
            {
              deviationid: 'dev-3',
              stats: { favourites: 200, comments: 75 },
            },
          ],
        }),
      } as Response);

      const result = await enrichDeviations(deviations, 'token-123', {
        includeStats: true,
      });

      expect(result[0].stats.favourites).toBe(100);
      expect(result[1].stats.favourites).toBe(10); // Original value
      expect(result[2].stats.favourites).toBe(200);
    });

    it('should handle empty metadata array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ metadata: [] }),
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123');

      expect(result).toEqual([mockDeviation]); // Return unenriched
    });

    it('should handle partial metadata (missing fields)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          metadata: [
            {
              deviationid: 'dev-123',
              stats: {
                favourites: 100,
                // comments missing
              },
              // author missing
            },
          ],
        }),
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123', {
        includeStats: true,
        includeAuthorAvatars: true,
      });

      expect(result[0].stats).toEqual({
        favourites: 100,
        comments: 5, // Falls back to original
      });
      expect(result[0].author.avatarUrl).toBe('https://a.deviantart.net/avatars/default.gif');
    });

    it('should preserve original deviation when enrichment disabled for that field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123', {
        includeStats: false,
        includeAuthorAvatars: false,
        includeTierInfo: false,
      });

      expect(result[0]).toEqual(mockDeviation);
    });

    it('should update category path from submission data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await enrichDeviations([mockDeviation], 'token-123');

      expect(result[0].category).toBe('digitalart/paintings');
    });

    it('should handle empty deviations array', async () => {
      const result = await enrichDeviations([], 'token-123');

      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should process multiple batches in parallel', async () => {
      const deviations = Array.from({ length: 100 }, (_, i) => ({
        ...mockDeviation,
        deviationId: `dev-${i}`,
      }));

      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({ metadata: [] }),
        } as Response;
      });

      await enrichDeviations(deviations, 'token-123', { maxBatchSize: 50 });

      // Both batches should have been called (parallel execution)
      expect(callCount).toBe(2);
    });
  });
});
