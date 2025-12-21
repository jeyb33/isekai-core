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
import { formatBytes } from './index.js';

describe('formatBytes', () => {
  describe('basic formatting', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes (< 1024)', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
      expect(formatBytes(1)).toBe('1 Bytes');
      expect(formatBytes(1023)).toBe('1023 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
      expect(formatBytes(5242880)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
      expect(formatBytes(5368709120)).toBe('5 GB');
    });
  });

  describe('precision and rounding', () => {
    it('should round to 2 decimal places', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1590)).toBe('1.55 KB');
      expect(formatBytes(1234567)).toBe('1.18 MB');
    });

    it('should handle very large numbers', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 500)).toBe('500 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 999.99)).toBe('999.99 GB');
    });

    it('should handle fractional bytes', () => {
      expect(formatBytes(512.5)).toBe('512.5 Bytes');
      expect(formatBytes(1024.7)).toBe('1 KB');
    });
  });

  describe('edge cases', () => {
    it('should handle boundary values', () => {
      // Test exact boundary between Bytes and KB
      expect(formatBytes(1023)).toBe('1023 Bytes');
      expect(formatBytes(1025)).toBe('1 KB');
    });

    it('should handle large file sizes', () => {
      const hundredGB = 1024 * 1024 * 1024 * 100;
      expect(formatBytes(hundredGB)).toBe('100 GB');
    });
  });
});
