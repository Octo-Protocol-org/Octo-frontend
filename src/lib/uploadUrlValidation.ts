import { isTrustedImageUrl } from "./isTrustedImageUrl";

const CLOUD_NAME_RE = /^[a-z0-9_-]{1,64}$/i;

/** Throw unless `name` is a plausible Cloudinary cloud name. */
export function assertValidCloudName(name: unknown): asserts name is string {
  if (typeof name !== "string" || !CLOUD_NAME_RE.test(name)) {
    throw new Error("Image upload is misconfigured (invalid cloud name).");
  }
}

/** Throw unless `url` is an https://res.cloudinary.com/<cloudName>/... URL. */
export function assertCloudinaryResultUrl(url: unknown, cloudName: string): string {
  if (typeof url !== "string" || !url) {
    throw new Error("Upload succeeded but returned no URL.");
  }
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    throw new Error("Upload returned an untrusted image URL.");
  }
  if (!isTrustedImageUrl(url) || !pathname.startsWith(`/${cloudName}/`)) {
    throw new Error("Upload returned an untrusted image URL.");
  }
  return url;
}
