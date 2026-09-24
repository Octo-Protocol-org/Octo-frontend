import { describe, expect, it } from 'vitest';

import { validateImage } from './uploads';

function makeFile(bytes: number[], type: string, name = 'image'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

describe('validateImage', () => {
  it('accepts allowed raster formats with matching signatures', async () => {
    await expect(validateImage(makeFile(PNG_HEADER, 'image/png'))).resolves.toBeUndefined();
    await expect(validateImage(makeFile(JPEG_HEADER, 'image/jpeg'))).resolves.toBeUndefined();
    await expect(validateImage(makeFile(WEBP_HEADER, 'image/webp'))).resolves.toBeUndefined();
    await expect(validateImage(makeFile(GIF_HEADER, 'image/gif'))).resolves.toBeUndefined();
  });

  it('rejects disallowed formats such as SVG', async () => {
    const svg = makeFile([0x3c, 0x73, 0x76, 0x67], 'image/svg+xml', 'logo.svg');
    await expect(validateImage(svg)).rejects.toThrow(/Unsupported image format/);
  });

  it('rejects files whose contents do not match the claimed type', async () => {
    const spoofed = makeFile([0x3c, 0x73, 0x76, 0x67], 'image/png', 'spoofed.png');
    await expect(validateImage(spoofed)).rejects.toThrow(/do not match its image type/);
  });
});
