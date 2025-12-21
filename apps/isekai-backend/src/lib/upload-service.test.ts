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

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  generateR2Key,
  getPublicUrl,
  checkStorageLimit,
  uploadToR2,
  deleteFromR2,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from './upload-service.js';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi.fn();
  return {
    S3Client: vi.fn(function(this: any) {
      this.send = mockSend;
    }),
    PutObjectCommand: vi.fn(function(this: any, params: any) {
      Object.assign(this, params);
    }),
    DeleteObjectCommand: vi.fn(function(this: any, params: any) {
      Object.assign(this, params);
    }),
  };
});

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

describe('upload-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateFileType', () => {
    it('should accept allowed image types', () => {
      expect(validateFileType('image/jpeg')).toBe(true);
      expect(validateFileType('image/png')).toBe(true);
      expect(validateFileType('image/gif')).toBe(true);
      expect(validateFileType('image/webp')).toBe(true);
    });

    it('should accept allowed video types', () => {
      expect(validateFileType('video/mp4')).toBe(true);
      expect(validateFileType('video/webm')).toBe(true);
      expect(validateFileType('video/quicktime')).toBe(true);
    });

    it('should reject disallowed mime types', () => {
      expect(validateFileType('application/pdf')).toBe(false);
      expect(validateFileType('text/plain')).toBe(false);
      expect(validateFileType('application/zip')).toBe(false);
      expect(validateFileType('image/svg+xml')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(validateFileType('IMAGE/JPEG')).toBe(false);
      expect(validateFileType('Image/Png')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateFileType('')).toBe(false);
    });

    it('should reject partial matches', () => {
      expect(validateFileType('image')).toBe(false);
      expect(validateFileType('jpeg')).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should accept valid file sizes', () => {
      expect(validateFileSize(1)).toBe(true);
      expect(validateFileSize(1024)).toBe(true);
      expect(validateFileSize(1024 * 1024)).toBe(true);
      expect(validateFileSize(MAX_FILE_SIZE)).toBe(true);
    });

    it('should reject file size of zero', () => {
      expect(validateFileSize(0)).toBe(false);
    });

    it('should reject negative file sizes', () => {
      expect(validateFileSize(-1)).toBe(false);
      expect(validateFileSize(-1000)).toBe(false);
    });

    it('should reject file sizes exceeding maximum', () => {
      expect(validateFileSize(MAX_FILE_SIZE + 1)).toBe(false);
      expect(validateFileSize(MAX_FILE_SIZE + 1000)).toBe(false);
      expect(validateFileSize(100 * 1024 * 1024)).toBe(false); // 100MB
    });

    it('should accept exactly at the maximum size', () => {
      expect(validateFileSize(MAX_FILE_SIZE)).toBe(true);
    });
  });

  describe('generateR2Key', () => {
    it('should generate key with correct structure', () => {
      const key = generateR2Key('user-123', 'my-image.jpg');
      expect(key).toMatch(/^deviations\/user-123\/my-image---[a-f0-9]{8}\.jpg$/);
    });

    it('should sanitize filename with special characters', () => {
      const key = generateR2Key('user-123', 'my file!@#$%.jpg');
      // Special characters are replaced with hyphens
      expect(key).toMatch(/^deviations\/user-123\/my-file-+---[a-f0-9]{8}\.jpg$/);
    });

    it('should handle different file extensions', () => {
      expect(generateR2Key('user-123', 'file.png')).toMatch(/\.png$/);
      expect(generateR2Key('user-123', 'file.gif')).toMatch(/\.gif$/);
      expect(generateR2Key('user-123', 'file.webp')).toMatch(/\.webp$/);
      expect(generateR2Key('user-123', 'file.mp4')).toMatch(/\.mp4$/);
    });

    it('should use filename as extension when no extension provided', () => {
      const key = generateR2Key('user-123', 'noextension');
      expect(key).toMatch(/\.noextension$/);
    });

    it('should truncate long filenames to 50 characters', () => {
      const longFilename = 'a'.repeat(100) + '.jpg';
      const key = generateR2Key('user-123', longFilename);
      const filenameWithoutExt = key.split('---')[0].split('/').pop();
      expect(filenameWithoutExt!.length).toBeLessThanOrEqual(50);
    });

    it('should replace non-alphanumeric characters with hyphens', () => {
      const key = generateR2Key('user-123', 'my image #1.jpg');
      expect(key).toMatch(/my-image--1/);
    });

    it('should preserve alphanumeric, hyphens, and underscores', () => {
      const key = generateR2Key('user-123', 'valid-file_name123.jpg');
      expect(key).toMatch(/valid-file_name123/);
    });

    it('should generate unique keys for same filename', () => {
      const key1 = generateR2Key('user-123', 'same.jpg');
      const key2 = generateR2Key('user-123', 'same.jpg');
      expect(key1).not.toBe(key2);
    });

    it('should include user ID in path', () => {
      const key = generateR2Key('user-456', 'file.jpg');
      expect(key).toMatch(/^deviations\/user-456\//);
    });
  });

  describe('getPublicUrl', () => {
    const originalEnv = process.env.R2_PUBLIC_URL;

    beforeEach(() => {
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
    });

    afterEach(() => {
      process.env.R2_PUBLIC_URL = originalEnv;
    });

    it('should construct public URL correctly', () => {
      const url = getPublicUrl('deviations/user-123/image.jpg');
      expect(url).toBe('https://cdn.example.com/deviations/user-123/image.jpg');
    });

    it('should handle different R2 keys', () => {
      expect(getPublicUrl('path/to/file.png')).toBe('https://cdn.example.com/path/to/file.png');
      expect(getPublicUrl('simple.jpg')).toBe('https://cdn.example.com/simple.jpg');
    });

    it('should preserve special characters in key', () => {
      const url = getPublicUrl('deviations/user-123/my-file---abc123.jpg');
      expect(url).toBe('https://cdn.example.com/deviations/user-123/my-file---abc123.jpg');
    });
  });

  describe('checkStorageLimit', () => {
    it('should return true when within limit', () => {
      expect(checkStorageLimit(1000, 500, 2000)).toBe(true);
      expect(checkStorageLimit(0, 1000, 1000)).toBe(true);
    });

    it('should return true when exactly at limit', () => {
      expect(checkStorageLimit(1000, 1000, 2000)).toBe(true);
    });

    it('should return false when exceeding limit', () => {
      expect(checkStorageLimit(1500, 600, 2000)).toBe(false);
      expect(checkStorageLimit(2000, 1, 2000)).toBe(false);
    });

    it('should handle zero current usage', () => {
      expect(checkStorageLimit(0, 1000, 1000)).toBe(true);
      expect(checkStorageLimit(0, 1001, 1000)).toBe(false);
    });

    it('should handle large file sizes', () => {
      const oneGB = 1024 * 1024 * 1024;
      const fiveGB = 5 * oneGB;
      expect(checkStorageLimit(oneGB, oneGB, fiveGB)).toBe(true);
      expect(checkStorageLimit(oneGB * 3, oneGB * 3, fiveGB)).toBe(false);
    });

    it('should work with different tier limits', () => {
      const freeTier = 1024 * 1024 * 100; // 100MB
      const proPier = 1024 * 1024 * 1000; // 1GB

      expect(checkStorageLimit(50 * 1024 * 1024, 60 * 1024 * 1024, freeTier)).toBe(false);
      expect(checkStorageLimit(50 * 1024 * 1024, 60 * 1024 * 1024, proPier)).toBe(true);
    });
  });

  describe('uploadToR2', () => {
    const originalEnv = process.env.R2_BUCKET_NAME;

    beforeEach(() => {
      process.env.R2_BUCKET_NAME = 'test-bucket';
    });

    afterEach(() => {
      process.env.R2_BUCKET_NAME = originalEnv;
    });

    it('should upload file with correct parameters', async () => {
      const buffer = Buffer.from('test file content');
      const r2Key = 'deviations/user-123/test.jpg';
      const mimeType = 'image/jpeg';

      await uploadToR2(r2Key, buffer, mimeType);

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: r2Key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
      });
    });

    it('should send command to S3 client', async () => {
      const buffer = Buffer.from('test');
      await uploadToR2('test.jpg', buffer, 'image/jpeg');

      const s3Instance = new S3Client({} as any);
      expect(s3Instance.send).toHaveBeenCalled();
    });

    it('should handle different mime types', async () => {
      const buffer = Buffer.from('video data');

      await uploadToR2('video.mp4', buffer, 'video/mp4');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: 'video/mp4' })
      );

      await uploadToR2('image.png', buffer, 'image/png');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: 'image/png' })
      );
    });

    it('should set correct content length', async () => {
      const smallBuffer = Buffer.from('small');
      const largeBuffer = Buffer.from('x'.repeat(1000));

      await uploadToR2('small.jpg', smallBuffer, 'image/jpeg');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentLength: smallBuffer.length })
      );

      await uploadToR2('large.jpg', largeBuffer, 'image/jpeg');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentLength: largeBuffer.length })
      );
    });
  });

  describe('deleteFromR2', () => {
    const originalEnv = process.env.R2_BUCKET_NAME;

    beforeEach(() => {
      process.env.R2_BUCKET_NAME = 'test-bucket';
    });

    afterEach(() => {
      process.env.R2_BUCKET_NAME = originalEnv;
    });

    it('should delete file with correct parameters', async () => {
      const r2Key = 'deviations/user-123/test.jpg';

      await deleteFromR2(r2Key);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: r2Key,
      });
    });

    it('should send command to S3 client', async () => {
      await deleteFromR2('test.jpg');

      const s3Instance = new S3Client({} as any);
      expect(s3Instance.send).toHaveBeenCalled();
    });

    it('should handle different R2 keys', async () => {
      await deleteFromR2('path/to/file.jpg');
      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: 'path/to/file.jpg' })
      );

      await deleteFromR2('simple.png');
      expect(DeleteObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: 'simple.png' })
      );
    });
  });

  describe('constants', () => {
    it('should have correct ALLOWED_MIME_TYPES', () => {
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/gif');
      expect(ALLOWED_MIME_TYPES).toContain('image/webp');
      expect(ALLOWED_MIME_TYPES).toContain('video/mp4');
      expect(ALLOWED_MIME_TYPES).toContain('video/webm');
      expect(ALLOWED_MIME_TYPES).toContain('video/quicktime');
      expect(ALLOWED_MIME_TYPES).toHaveLength(7);
    });

    it('should have correct MAX_FILE_SIZE', () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024); // 50MB
    });
  });
});
