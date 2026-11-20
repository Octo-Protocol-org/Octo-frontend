/** Direct-to-Cloudinary image upload, signed by the Octo API. */

"use client";

import { apiFetch } from "./api";
import { assertCloudinaryResultUrl, assertValidCloudName } from "./uploadUrlValidation";

type UploadSignature = {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  folder: string;
  signature: string;
};

const UPLOAD_TIMEOUT_MS = 60_000;

type CloudinaryUploadResponse = { secure_url?: string };

/**
 * Upload `file` to Cloudinary and return its secure URL.
 *
 * The API secret never reaches the browser: Octo signs the upload parameters, and the file bytes
 * go straight to Cloudinary rather than through the Octo API. Only params covered by the
 * signature may be sent — adding others makes Cloudinary reject the upload.
 */
export async function uploadImage(
  token: string,
  file: File,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? UPLOAD_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  const sig = await apiFetch<UploadSignature>("/v1/uploads/signature", { token, signal });

  assertValidCloudName(sig.cloud_name);
  const cloudName = encodeURIComponent(sig.cloud_name);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.api_key);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("Image upload timed out. Try again or use a smaller image.");
    }
    throw err;
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {
      // non-JSON error body
    }
    throw new Error(detail || `Image upload failed (${res.status})`);
  }
  const body = (await res.json()) as CloudinaryUploadResponse;
  return assertCloudinaryResultUrl(body?.secure_url, sig.cloud_name);
}

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const FORMAT_NAMES: Record<AllowedImageType, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
};

/** Hint text for image pickers, generated from ALLOWED_IMAGE_TYPES. */
export const ALLOWED_IMAGE_HINT = `${ALLOWED_IMAGE_TYPES.map((type) => FORMAT_NAMES[type]).join(', ')}, up to 2MB.`;

type Signature = number[] | { offset: number; bytes: number[] }[];

const MAGIC_NUMBERS: Record<AllowedImageType, Signature[]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/webp': [
    [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
    ],
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
};

function matchesMagicNumber(bytes: Uint8Array, signatures: Signature[]): boolean {
  return signatures.some((signature) =>
    (signature.length > 0 && typeof signature[0] === 'object'
      ? (signature as { offset: number; bytes: number[] }[])
      : [{ offset: 0, bytes: signature as number[] }]
    ).every((part) => part.bytes.every((byte, index) => bytes[part.offset + index] === byte)),
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

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signatures = MAGIC_NUMBERS[file.type as AllowedImageType];

  if (!matchesMagicNumber(header, signatures)) {
    throw new Error(
      'The file contents do not match its image type. Please upload a valid PNG, JPEG, WebP, or GIF file.',
    );
  }
}
