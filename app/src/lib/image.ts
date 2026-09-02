/**
 * Downscale + JPEG-compress a photo client-side so uploads stay small.
 *
 * `maxBytes` is a hard budget on the *decoded* image, because the server counts
 * decoded bytes too (see decodeImage). It matters on a serverless deployment:
 * Vercel caps request bodies at 4.5 MB, base64 inflates by 4/3, and the API
 * therefore rejects slips over 2.5 MB and avatars over 2 MB. A phone photo
 * shrinks well below that at 1280px, but a high-megapixel or low-detail-loss
 * image can still land over it — so step the quality down, then the dimensions,
 * until it fits rather than letting the upload fail with a 413.
 */
export async function compressImage(
  file: File,
  maxSide = 1280,
  quality = 0.82,
  maxBytes = 2_000_000,
): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    const render = (side: number, q: number): string => {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', q);
    };

    // Decoded size of a data: URI — base64 is 4 chars per 3 bytes, minus padding.
    const decodedBytes = (dataUri: string): number => {
      const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
      const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
      return Math.floor((b64.length * 3) / 4) - padding;
    };

    let out = render(maxSide, quality);
    let side = maxSide;
    let q = quality;

    // Quality first (cheaper visually), then dimensions. Bounded, so a
    // pathological input terminates instead of looping.
    for (let attempt = 0; attempt < 6 && decodedBytes(out) > maxBytes; attempt++) {
      if (q > 0.5) q -= 0.12;
      else side = Math.round(side * 0.75);
      out = render(side, q);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
