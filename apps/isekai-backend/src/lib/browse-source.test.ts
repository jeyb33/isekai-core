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

import { describe, it, expect } from 'vitest';
import { getBrowseSource, type BrowseMode, type BrowseParams } from './browse-source.js';

describe('getBrowseSource', () => {
  describe('all browse modes', () => {
    const modes: BrowseMode[] = ['home', 'daily', 'following', 'tags', 'topic', 'user-gallery'];

    modes.forEach((mode) => {
      it(`should return API source for ${mode} mode`, () => {
        const result = getBrowseSource(mode, {});
        expect(result).toEqual({ source: 'api' });
      });
    });
  });

  describe('with various parameters', () => {
    it('should return API source with offset parameter', () => {
      const result = getBrowseSource('home', { offset: 10 });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with limit parameter', () => {
      const result = getBrowseSource('home', { limit: 50 });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with tag parameter', () => {
      const result = getBrowseSource('tags', { tag: 'digitalart' });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with date parameter', () => {
      const result = getBrowseSource('daily', { date: '2025-12-21' });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with topic parameter', () => {
      const result = getBrowseSource('topic', { topic: 'fantasy' });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with username parameter', () => {
      const result = getBrowseSource('user-gallery', { username: 'testuser' });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with keywords parameter', () => {
      const result = getBrowseSource('home', { keywords: 'landscape' });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with mature_content parameter', () => {
      const result = getBrowseSource('home', { mature_content: true });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with multiple parameters', () => {
      const params: BrowseParams = {
        offset: 20,
        limit: 30,
        tag: 'anime',
        mature_content: false,
      };
      const result = getBrowseSource('tags', params);
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with all parameters', () => {
      const params: BrowseParams = {
        offset: 0,
        limit: 100,
        tag: 'fantasy',
        date: '2025-12-21',
        topic: 'art',
        username: 'artist123',
        keywords: 'dragon',
        mature_content: true,
      };
      const result = getBrowseSource('home', params);
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with empty parameters', () => {
      const result = getBrowseSource('home', {});
      expect(result).toEqual({ source: 'api' });
    });
  });

  describe('edge cases', () => {
    it('should return API source with zero offset', () => {
      const result = getBrowseSource('home', { offset: 0 });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with zero limit', () => {
      const result = getBrowseSource('home', { limit: 0 });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with large offset', () => {
      const result = getBrowseSource('home', { offset: 999999 });
      expect(result).toEqual({ source: 'api' });
    });

    it('should return API source with large limit', () => {
      const result = getBrowseSource('home', { limit: 999999 });
      expect(result).toEqual({ source: 'api' });
    });
  });

  describe('consistency', () => {
    it('should return the same result for identical calls', () => {
      const params: BrowseParams = { offset: 10, limit: 20 };
      const result1 = getBrowseSource('home', params);
      const result2 = getBrowseSource('home', params);
      expect(result1).toEqual(result2);
    });

    it('should always return object with source property', () => {
      const result = getBrowseSource('home', {});
      expect(result).toHaveProperty('source');
      expect(result.source).toBe('api');
    });
  });
});
