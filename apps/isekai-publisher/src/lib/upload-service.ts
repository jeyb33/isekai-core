import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client for Cloudflare R2
export const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Delete file from R2
export async function deleteFromR2(r2Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: r2Key,
  });
  await s3Client.send(command);
}
