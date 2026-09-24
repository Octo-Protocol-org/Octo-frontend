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

export async function validateImage(file: File): Promise<void> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    throw new Error(
      'Unsupported image format. Please upload a PNG, JPEG, WebP, or GIF file.',
    );
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signatures = MAGIC_NUMBERS[file.type as AllowedImageType];

  if (!matchesMagicNumber(header, signatures)) {
    throw new Error(
      'The file contents do not match its image type. Please upload a valid PNG, JPEG, WebP, or GIF file.',
    );
  }
}
