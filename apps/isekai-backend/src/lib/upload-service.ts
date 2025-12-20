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

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

// Initialize S3 client for Cloudflare R2
export const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// File validation constants
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Validation functions
export function validateFileType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

export function validateFileSize(fileSize: number): boolean {
  return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
}

// Generate R2 key with sanitized filename
export function generateR2Key(userId: string, filename: string): string {
  const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const sanitized = filenameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .slice(0, 50);
  const shortUuid = randomUUID().split("-")[0]; // 8 chars
  const ext = filename.split(".").pop() || "jpg";
  return `deviations/${userId}/${sanitized}---${shortUuid}.${ext}`;
}

// Upload file directly to R2
export async function uploadToR2(
  r2Key: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
  });
  await s3Client.send(command);
}

// Delete from R2
export async function deleteFromR2(r2Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
  });
  await s3Client.send(command);
}

// Get public URL for R2 object
export function getPublicUrl(r2Key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${r2Key}`;
}

// Check if user has enough storage for file
export function checkStorageLimit(
  currentUsage: number,
  fileSize: number,
  tierLimit: number
): boolean {
  return currentUsage + fileSize <= tierLimit;
}
