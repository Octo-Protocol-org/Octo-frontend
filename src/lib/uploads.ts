/** Direct-to-Cloudinary image upload, signed by the Octo API. */

"use client";

import { apiFetch } from "./api";

type UploadSignature = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/**
 * Upload `file` to Cloudinary and return its secure URL.
 *
 * The API secret never reaches the browser: Octo signs the upload parameters, and the file bytes
 * go straight to Cloudinary rather than through the Octo API. Only params covered by the
 * signature may be sent — adding others makes Cloudinary reject the upload.
 */
export async function uploadImage(token: string, file: File): Promise<string> {
  const sig = await apiFetch<UploadSignature>("/v1/uploads/signature", { token });

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.api_key);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {
      // non-JSON error body
    }
    throw new Error(detail || `Image upload failed (${res.status})`);
  }
  const body = await res.json();
  if (!body.secure_url) throw new Error("Upload succeeded but returned no URL.");
  return body.secure_url as string;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const MAGIC_NUMBERS: Record<AllowedImageType, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
};

function matchesMagicNumber(bytes: Uint8Array, signatures: number[][]): boolean {
  return signatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte),
  );
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Reject non-raster, oversized, or type-spoofed files before they are uploaded. */
export async function validateImage(file: File): Promise<void> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    throw new Error(
      'Unsupported image format. Please upload a PNG, JPEG, WebP, or GIF file.',
    );
  }

  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 2MB or smaller.');

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signatures = MAGIC_NUMBERS[file.type as AllowedImageType];

  if (!matchesMagicNumber(header, signatures)) {
    throw new Error(
      'The file contents do not match its image type. Please upload a valid PNG, JPEG, WebP, or GIF file.',
    );
  }
}
