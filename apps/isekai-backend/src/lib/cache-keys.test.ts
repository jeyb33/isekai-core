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
import {
  CACHE_VERSION,
  CACHE_PREFIX,
  CacheNamespace,
  generateCacheKey,
  generateCacheKeyPattern,
  generateStaleCacheKey,
  parseCacheKey,
  CacheKeys,
} from './cache-keys.js';

describe('Constants', () => {
  it('should have correct cache version', () => {
    expect(CACHE_VERSION).toBe('v1');
  });

  it('should have correct cache prefix', () => {
    expect(CACHE_PREFIX).toBe('isekai');
  });

  it('should have all cache namespaces', () => {
    expect(CacheNamespace.BROWSE).toBe('browse');
    expect(CacheNamespace.ANALYTICS).toBe('analytics');
    expect(CacheNamespace.MESSAGES).toBe('messages');
    expect(CacheNamespace.DEVIATION).toBe('deviation');
    expect(CacheNamespace.GALLERY).toBe('gallery');
    expect(CacheNamespace.CATEGORY).toBe('category');
    expect(CacheNamespace.TOPIC).toBe('topic');
    expect(CacheNamespace.TAG).toBe('tag');
    expect(CacheNamespace.USER).toBe('user');
  });
});

describe('generateCacheKey', () => {
  describe('basic key generation', () => {
    it('should generate key with minimum params', () => {
      const key = generateCacheKey('browse', 'user', '12345');
      expect(key).toBe('isekai:v1:browse:user:12345');
    });

    it('should generate key with global scope', () => {
      const key = generateCacheKey('category', 'global', 'tree');
      expect(key).toBe('isekai:v1:category:global:tree');
    });

    it('should generate key with user scope', () => {
      const key = generateCacheKey('analytics', 'user', 'user123');
      expect(key).toBe('isekai:v1:analytics:user:user123');
    });
  });

  describe('with parameters', () => {
    it('should append single parameter', () => {
      const key = generateCacheKey('browse', 'user', '12345', { mode: 'home' });
      expect(key).toBe('isekai:v1:browse:user:12345:home');
    });

    it('should append multiple parameters in sorted order', () => {
      const key = generateCacheKey('browse', 'user', '12345', {
        mode: 'home',
        source: 'api',
        mature: true,
        offset: 0,
      });
      expect(key).toBe('isekai:v1:browse:user:12345:true:home:0:api');
    });

    it('should sort parameters alphabetically by key', () => {
      const key = generateCacheKey('test', 'user', 'id', {
        zebra: 'last',
        apple: 'first',
        middle: 'second',
      });
      expect(key).toContain(':first:second:last');
    });

    it('should handle string parameters', () => {
      const key = generateCacheKey('tag', 'global', 'search', { q: 'nature' });
      expect(key).toBe('isekai:v1:tag:global:search:nature');
    });

    it('should handle number parameters', () => {
      const key = generateCacheKey('analytics', 'user', 'user1', {
        offset: 100,
        limit: 50,
      });
      expect(key).toContain(':50:100');
    });

    it('should handle boolean parameters', () => {
      const key = generateCacheKey('browse', 'user', 'id', {
        mature: true,
        premium: false,
      });
      expect(key).toContain(':true:false');
    });
  });

  describe('special value handling', () => {
    it('should handle null values', () => {
      const key = generateCacheKey('messages', 'user', 'user1', {
        cursor: null,
      });
      expect(key).toBe('isekai:v1:messages:user:user1:null');
    });

    it('should handle undefined values', () => {
      const key = generateCacheKey('browse', 'user', 'id', {
        optional: undefined,
      });
      expect(key).toBe('isekai:v1:browse:user:id:null');
    });

    it('should hash object parameters', () => {
      const key = generateCacheKey('browse', 'user', 'id', {
        filter: { category: 'digitalart', subcategory: 'paintings' },
      });
      // Should contain a hash instead of the full object
      expect(key).toMatch(/^isekai:v1:browse:user:id:[a-z0-9]+$/);
      expect(key).not.toContain('digitalart');
      expect(key).not.toContain('paintings');
    });

    it('should produce consistent hash for same object', () => {
      const obj = { category: 'digitalart', subcategory: 'paintings' };
      const key1 = generateCacheKey('browse', 'user', 'id', { filter: obj });
      const key2 = generateCacheKey('browse', 'user', 'id', { filter: obj });
      expect(key1).toBe(key2);
    });

    it('should produce different hash for different objects', () => {
      const key1 = generateCacheKey('browse', 'user', 'id', {
        filter: { category: 'digitalart' },
      });
      const key2 = generateCacheKey('browse', 'user', 'id', {
        filter: { category: 'photography' },
      });
      expect(key1).not.toBe(key2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty params object', () => {
      const key = generateCacheKey('browse', 'user', 'id', {});
      expect(key).toBe('isekai:v1:browse:user:id');
    });

    it('should handle special characters in identifier', () => {
      const key = generateCacheKey('deviation', 'global', 'abc-123_xyz');
      expect(key).toBe('isekai:v1:deviation:global:abc-123_xyz');
    });

    it('should handle empty string identifier', () => {
      const key = generateCacheKey('browse', 'global', '');
      expect(key).toBe('isekai:v1:browse:global:');
    });

    it('should convert number to string in parameters', () => {
      const key = generateCacheKey('analytics', 'user', 'id', { count: 0 });
      expect(key).toBe('isekai:v1:analytics:user:id:0');
    });
  });
});

describe('generateCacheKeyPattern', () => {
  it('should generate wildcard pattern', () => {
    const pattern = generateCacheKeyPattern('browse', 'user', '12345');
    expect(pattern).toBe('isekai:v1:browse:user:12345:*');
  });

  it('should generate global scope pattern', () => {
    const pattern = generateCacheKeyPattern('category', 'global', 'tree');
    expect(pattern).toBe('isekai:v1:category:global:tree:*');
  });

  it('should generate user scope pattern', () => {
    const pattern = generateCacheKeyPattern('analytics', 'user', 'user123');
    expect(pattern).toBe('isekai:v1:analytics:user:user123:*');
  });
});

describe('generateStaleCacheKey', () => {
  it('should append :stale to basic key', () => {
    const key = generateStaleCacheKey('browse', 'user', '12345');
    expect(key).toBe('isekai:v1:browse:user:12345:stale');
  });

  it('should append :stale to key with params', () => {
    const key = generateStaleCacheKey('browse', 'user', '12345', {
      mode: 'home',
      offset: 0,
    });
    expect(key).toBe('isekai:v1:browse:user:12345:home:0:stale');
  });

  it('should handle global scope', () => {
    const key = generateStaleCacheKey('category', 'global', 'tree');
    expect(key).toBe('isekai:v1:category:global:tree:stale');
  });
});

describe('parseCacheKey', () => {
  it('should parse valid cache key', () => {
    const key = 'isekai:v1:browse:user:12345';
    const parsed = parseCacheKey(key);

    expect(parsed).toEqual({
      prefix: 'isekai',
      version: 'v1',
      namespace: 'browse',
      scope: 'user',
      identifier: '12345',
      params: [],
    });
  });

  it('should parse key with parameters', () => {
    const key = 'isekai:v1:browse:user:12345:home:api:true:0';
    const parsed = parseCacheKey(key);

    expect(parsed).toEqual({
      prefix: 'isekai',
      version: 'v1',
      namespace: 'browse',
      scope: 'user',
      identifier: '12345',
      params: ['home', 'api', 'true', '0'],
    });
  });

  it('should parse global scope key', () => {
    const key = 'isekai:v1:category:global:tree';
    const parsed = parseCacheKey(key);

    expect(parsed?.scope).toBe('global');
  });

  it('should parse stale key', () => {
    const key = 'isekai:v1:browse:user:12345:stale';
    const parsed = parseCacheKey(key);

    expect(parsed?.params).toEqual(['stale']);
  });

  it('should return null for invalid key with too few parts', () => {
    const key = 'isekai:v1:browse:user';
    const parsed = parseCacheKey(key);

    expect(parsed).toBeNull();
  });

  it('should return null for empty key', () => {
    const parsed = parseCacheKey('');
    expect(parsed).toBeNull();
  });

  it('should return null for key with only 3 parts', () => {
    const parsed = parseCacheKey('isekai:v1:browse');
    expect(parsed).toBeNull();
  });
});

describe('CacheKeys.browse', () => {
  describe('feed', () => {
    it('should generate user-specific feed key', () => {
      const key = CacheKeys.browse.feed('user123', 'home', 'api', true, 0);
      expect(key).toBe('isekai:v1:browse:user:user123:true:home:0:api');
    });

    it('should generate global feed key when userId is null', () => {
      const key = CacheKeys.browse.feed(null, 'popular', 'api', false, 10);
      expect(key).toBe('isekai:v1:browse:global:popular:false:10:api');
    });

    it('should handle different modes', () => {
      const key = CacheKeys.browse.feed('user1', 'newest', 'api', true, 0);
      expect(key).toContain(':newest:');
    });

    it('should handle different sources', () => {
      const key = CacheKeys.browse.feed('user1', 'home', 'cache', true, 0);
      expect(key).toContain(':cache');
    });

    it('should handle mature content flag', () => {
      const keyWithMature = CacheKeys.browse.feed('user1', 'home', 'api', true, 0);
      const keyWithoutMature = CacheKeys.browse.feed('user1', 'home', 'api', false, 0);
      expect(keyWithMature).toContain(':true:');
      expect(keyWithoutMature).toContain(':false:');
    });

    it('should handle different offsets', () => {
      const key = CacheKeys.browse.feed('user1', 'home', 'api', true, 50);
      expect(key).toContain(':50:');
    });
  });

  describe('deviation', () => {
    it('should generate deviation cache key', () => {
      const key = CacheKeys.browse.deviation('deviation123');
      expect(key).toBe('isekai:v1:deviation:global:deviation123');
    });

    it('should use global scope', () => {
      const key = CacheKeys.browse.deviation('dev456');
      expect(key).toContain(':global:');
    });
  });

  describe('morelikethis', () => {
    it('should generate morelikethis cache key', () => {
      const key = CacheKeys.browse.morelikethis('deviation123');
      expect(key).toBe('isekai:v1:browse:global:morelikethis:deviation123');
    });

    it('should use browse namespace and global scope', () => {
      const key = CacheKeys.browse.morelikethis('dev456');
      expect(key).toContain('browse:global:morelikethis');
    });
  });
});

describe('CacheKeys.analytics', () => {
  describe('overview', () => {
    it('should generate overview cache key', () => {
      const key = CacheKeys.analytics.overview('user123', '30d');
      expect(key).toBe('isekai:v1:analytics:user:user123:30d:overview');
    });

    it('should handle different periods', () => {
      const key = CacheKeys.analytics.overview('user1', '7d');
      expect(key).toContain(':7d:');
    });
  });

  describe('posts', () => {
    it('should generate posts cache key', () => {
      const key = CacheKeys.analytics.posts('user123', 0, 20);
      // Params sorted alphabetically: limit, offset, type
      expect(key).toBe('isekai:v1:analytics:user:user123:20:0:posts');
    });

    it('should handle pagination', () => {
      const key = CacheKeys.analytics.posts('user1', 40, 20);
      // Params sorted alphabetically: limit, offset, type
      expect(key).toContain(':20:40:');
    });
  });

  describe('bestTimes', () => {
    it('should generate best times cache key', () => {
      const key = CacheKeys.analytics.bestTimes('user123', '30d');
      // Params sorted alphabetically: period, type
      expect(key).toBe('isekai:v1:analytics:user:user123:30d:best-times');
    });
  });

  describe('whofaved', () => {
    it('should generate whofaved cache key', () => {
      const key = CacheKeys.analytics.whofaved('user123', 'dev456', 0);
      expect(key).toBe('isekai:v1:analytics:user:user123:dev456:0:whofaved');
    });

    it('should include deviation ID and offset', () => {
      const key = CacheKeys.analytics.whofaved('user1', 'deviation789', 20);
      expect(key).toContain(':deviation789:20:');
    });
  });

  describe('audience', () => {
    it('should generate audience cache key', () => {
      const key = CacheKeys.analytics.audience('user123', '30d');
      // Params sorted alphabetically: period, type
      expect(key).toBe('isekai:v1:analytics:user:user123:30d:audience');
    });
  });
});

describe('CacheKeys.messages', () => {
  describe('notifications', () => {
    it('should generate notifications cache key with cursor', () => {
      const key = CacheKeys.messages.notifications('user123', 'replies', 'cursor123');
      // Params sorted alphabetically: cursor, feed, type
      expect(key).toBe('isekai:v1:messages:user:user123:cursor123:replies:notifications');
    });

    it('should handle null cursor', () => {
      const key = CacheKeys.messages.notifications('user123', 'mentions', null);
      // Params sorted alphabetically: cursor, feed, type
      expect(key).toBe('isekai:v1:messages:user:user123:null:mentions:notifications');
    });

    it('should handle different notification types', () => {
      const key = CacheKeys.messages.notifications('user1', 'all', null);
      // Params sorted alphabetically: cursor, feed, type
      expect(key).toContain(':all:');
    });
  });

  describe('note', () => {
    it('should generate note cache key', () => {
      const key = CacheKeys.messages.note('user123', 'note456');
      // Params sorted alphabetically: noteId, type
      expect(key).toBe('isekai:v1:messages:user:user123:note456:note');
    });
  });

  describe('folders', () => {
    it('should generate folders cache key', () => {
      const key = CacheKeys.messages.folders('user123');
      expect(key).toBe('isekai:v1:messages:user:user123:folders');
    });
  });
});

describe('CacheKeys.category', () => {
  describe('tree', () => {
    it('should generate category tree cache key', () => {
      const key = CacheKeys.category.tree();
      expect(key).toBe('isekai:v1:category:global:tree');
    });

    it('should use global scope', () => {
      const key = CacheKeys.category.tree();
      expect(key).toContain(':global:');
    });
  });
});

describe('CacheKeys.topic', () => {
  describe('list', () => {
    it('should generate topic list cache key', () => {
      const key = CacheKeys.topic.list();
      expect(key).toBe('isekai:v1:topic:global:list');
    });
  });

  describe('top', () => {
    it('should generate top topics cache key', () => {
      const key = CacheKeys.topic.top();
      expect(key).toBe('isekai:v1:topic:global:top');
    });
  });

  describe('trendingTags', () => {
    it('should generate trending tags cache key', () => {
      const key = CacheKeys.topic.trendingTags();
      expect(key).toBe('isekai:v1:topic:global:trending-tags');
    });
  });
});

describe('CacheKeys.tag', () => {
  describe('search', () => {
    it('should generate tag search cache key', () => {
      const key = CacheKeys.tag.search('nature');
      expect(key).toBe('isekai:v1:tag:global:search:nature');
    });

    it('should normalize query to lowercase', () => {
      const key = CacheKeys.tag.search('NATURE');
      expect(key).toContain(':nature');
    });

    it('should trim whitespace from query', () => {
      const key = CacheKeys.tag.search('  nature  ');
      expect(key).toBe('isekai:v1:tag:global:search:nature');
    });

    it('should handle multi-word queries', () => {
      const key = CacheKeys.tag.search('digital art');
      expect(key).toContain(':digital art');
    });
  });
});

describe('CacheKeys.gallery', () => {
  describe('folders', () => {
    it('should generate gallery folders cache key', () => {
      const key = CacheKeys.gallery.folders('user123');
      expect(key).toBe('isekai:v1:gallery:user:user123:folders');
    });
  });
});

describe('CacheKeys.user', () => {
  describe('profile', () => {
    it('should generate user profile cache key', () => {
      const key = CacheKeys.user.profile('user123');
      expect(key).toBe('isekai:v1:user:user:user123:profile');
    });
  });
});

describe('Integration tests', () => {
  it('should generate consistent keys for same inputs', () => {
    const key1 = CacheKeys.browse.feed('user1', 'home', 'api', true, 0);
    const key2 = CacheKeys.browse.feed('user1', 'home', 'api', true, 0);
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const key1 = CacheKeys.browse.feed('user1', 'home', 'api', true, 0);
    const key2 = CacheKeys.browse.feed('user2', 'home', 'api', true, 0);
    expect(key1).not.toBe(key2);
  });

  it('should parse generated keys correctly', () => {
    const key = CacheKeys.analytics.overview('user123', '30d');
    const parsed = parseCacheKey(key);

    expect(parsed).not.toBeNull();
    expect(parsed?.namespace).toBe('analytics');
    expect(parsed?.scope).toBe('user');
    expect(parsed?.identifier).toBe('user123');
  });

  it('should work with stale key generation', () => {
    const normalKey = CacheKeys.browse.feed('user1', 'home', 'api', true, 0);
    const staleKey = generateStaleCacheKey('browse', 'user', 'user1', {
      mode: 'home',
      source: 'api',
      mature: true,
      offset: 0,
    });

    expect(staleKey).toBe(`${normalKey}:stale`);
  });

  it('should work with pattern generation', () => {
    const pattern = generateCacheKeyPattern('browse', 'user', 'user123');
    const key = CacheKeys.browse.feed('user123', 'home', 'api', true, 0);

    // Pattern should match the beginning of the key
    expect(key.startsWith(pattern.replace(':*', ''))).toBe(true);
  });
});
