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

/** Client-side guard so obviously-bad files fail fast instead of round-tripping. */
export function validateImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (file.size > 2 * 1024 * 1024) return "Image must be 2MB or smaller.";
  return null;
}
