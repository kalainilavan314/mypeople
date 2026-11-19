/**
 * A one-page PDF holding a JPEG picture of the certificate (FR-RNW-004). The certificate is drawn by
 * the app in its locked fonts, so Tamil is shaped exactly as on screen; the PDF only frames that
 * picture at A4 width. No PDF library is needed: a PDF can carry a JPEG as it is (DCTDecode).
 */

const A4_WIDTH_POINTS = 595.28;

type JpegInfo = { width: number; height: number; components: number };

/** Width, height and colour components from the JPEG's start-of-frame marker. */
export function readJpegInfo(jpeg: Uint8Array): JpegInfo {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG');
  let offset = 2;
  while (offset + 9 < jpeg.length) {
    if (jpeg[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = jpeg[offset + 1];
    const length = (jpeg[offset + 2] << 8) | jpeg[offset + 3];
    // SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (jpeg[offset + 5] << 8) | jpeg[offset + 6],
        width: (jpeg[offset + 7] << 8) | jpeg[offset + 8],
        components: jpeg[offset + 9],
      };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG size not found');
}

function ascii(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
}

/** The PDF bytes for one page showing the JPEG at A4 width, its height kept in proportion. */
export function jpegToPdf(jpeg: Uint8Array): Uint8Array {
  const { width, height, components } = readJpegInfo(jpeg);
  const pageWidth = A4_WIDTH_POINTS;
  const pageHeight = Math.round((pageWidth * height * 100) / width) / 100;
  const colourSpace = components === 1 ? '/DeviceGray' : components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
  const drawing = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Certificate Do Q`;

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let size = 0;
  const add = (piece: Uint8Array | string) => {
    const bytes = typeof piece === 'string' ? ascii(piece) : piece;
    parts.push(bytes);
    size += bytes.length;
  };
  const object = (body: string) => {
    offsets.push(size);
    add(`${offsets.length} 0 obj\n${body}\nendobj\n`);
  };

  add('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  object('<< /Type /Catalog /Pages 2 0 R >>');
  object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      '/Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>',
  );
  offsets.push(size);
  add(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colourSpace} ` +
      `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  add(jpeg);
  add('\nendstream\nendobj\n');
  object(`<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`);

  const xref = size;
  add(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) add(`${String(offset).padStart(10, '0')} 00000 n \n`);
  add(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const pdf = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    pdf.set(part, at);
    at += part.length;
  }
  return pdf;
}

/** The bytes of a base64 string (a canvas's data URL on the web). */
export function base64Bytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
