// The extension alone is not trusted: the file's first bytes must match it.
export function hasExpectedSignature(ext: string, bytes: Uint8Array) {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  const ascii = (offset: number, text: string) =>
    [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  switch (ext) {
    case "pdf":
      return ascii(0, "%PDF-");
    case "png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "jpg":
    case "jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    default:
      return false;
  }
}
