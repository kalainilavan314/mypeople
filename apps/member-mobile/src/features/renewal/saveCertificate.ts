import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ElementRef, RefObject } from 'react';
import { Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { base64Bytes, jpegToPdf } from './certificatePdf';
import type { CertificateText } from './certificateText';
import { drawCertificateJpeg } from './webCertificate';

/** Pixel width of the picture inside the PDF: 150 dpi across an A4 page. */
const PICTURE_WIDTH = 1240;

/**
 * M34: the certificate as a PDF the member keeps or shares. On a phone the on-screen certificate is
 * photographed and handed to the share sheet ("Save to Files", a messaging app); the copy the app
 * wrote is deleted afterwards. In a browser the same certificate is drawn and downloaded.
 */
export async function saveCertificatePdf(
  view: RefObject<ElementRef<typeof View> | null>,
  size: { width: number; height: number },
  text: CertificateText,
  fileName: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    const pdf = jpegToPdf(base64Bytes(await drawCertificateJpeg(text)));
    downloadInBrowser(pdf, fileName);
    return;
  }
  if (!view.current) throw new Error('Certificate not on screen');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Share sheet unavailable');
  const picture = await captureRef(view.current, {
    format: 'jpg',
    quality: 0.92,
    result: 'tmpfile',
    width: PICTURE_WIDTH,
    height: Math.round((PICTURE_WIDTH * size.height) / size.width),
  });
  const pictureFile = new File(picture);
  const pdfFile = new File(Paths.cache, fileName);
  try {
    const pdf = jpegToPdf(await pictureFile.bytes());
    pdfFile.create({ overwrite: true });
    pdfFile.write(pdf);
    await Sharing.shareAsync(pdfFile.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } finally {
    for (const file of [pictureFile, pdfFile]) {
      try {
        if (file.exists) file.delete();
      } catch {
        // The system clears its cache too; a leftover copy is not worth failing the download for.
      }
    }
  }
}

function downloadInBrowser(pdf: Uint8Array, fileName: string): void {
  const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
