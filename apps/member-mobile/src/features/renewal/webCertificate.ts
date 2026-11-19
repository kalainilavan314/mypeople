import QRCode from 'qrcode';

import { colors as party } from '@my-people/design-tokens';
import { fontFamilyFor, monoFontFamily } from '@my-people/mobile-ui';

import type { CertificateText } from './certificateText';

const WIDTH = 1240;
const HEIGHT = 1754; // A4 portrait at 150 dpi
const MARGIN = 110;
const TAMIL = /[஀-௿]/;

type Weight = 400 | 600 | 700;

/**
 * The browser's copy of the certificate (FR-RNW-004): the same words and QR as the app's view,
 * drawn on a canvas in the app's own loaded fonts (picked by script, as AppText does), returned as a
 * JPEG for the PDF. The phone apps photograph the on-screen view instead.
 */
export async function drawCertificateJpeg(text: CertificateText): Promise<string> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  const ctx = context;

  ctx.fillStyle = party.page;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = party.card;
  ctx.fillRect(40, 40, WIDTH - 80, HEIGHT - 80);
  ctx.strokeStyle = party.brandGold;
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, WIDTH - 80, HEIGHT - 80);

  let y = 150;
  const write = (line: string, size: number, weight: Weight, color: string, align: 'center' | 'left' = 'center',
                 x = WIDTH / 2, maxWidth = WIDTH - MARGIN * 2): void => {
    const family = TAMIL.test(line) ? fontFamilyFor('ta', weight) : fontFamilyFor('en', weight);
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    for (const part of wrap(ctx, line, maxWidth)) {
      ctx.fillText(part, x, y);
      y += Math.round(size * 1.45);
    }
  };

  write(text.party.ta, 44, 700, party.primary);
  write(`${text.party.en} · TMK`, 30, 600, party.primary);
  y += 10;
  ctx.fillStyle = party.primary;
  ctx.fillRect(MARGIN + 120, y, WIDTH - (MARGIN + 120) * 2, 6);
  y += 90;
  write(text.title.ta, 56, 700, party.text);
  write(text.title.en, 34, 400, party.textSecondary);
  y += 40;
  write(text.certifies.ta, 30, 400, party.textSecondary);
  write(text.certifies.en, 28, 400, party.textSecondary);
  y += 30;
  write(text.holder, 64, 700, party.text);
  y += 20;
  write(text.body.ta, 36, 400, party.text);
  write(text.body.en, 30, 400, party.textSecondary);
  y += 20;
  for (const item of text.items) {
    write(`• ${item.ta}`, 28, 400, party.text, 'left', MARGIN + 40);
    write(item.en, 24, 400, party.textSecondary, 'left', MARGIN + 70);
  }
  if (text.more) write(`${text.more.ta} · ${text.more.en}`, 24, 400, party.textSecondary, 'left', MARGIN + 40);

  // The QR and the facts sit at the foot of the page, whatever the length of the text above.
  const qrSize = 320;
  const qrTop = HEIGHT - MARGIN - 120 - qrSize;
  if (text.url) drawQr(ctx, text.url, MARGIN, qrTop, qrSize);
  y = qrTop + 40;
  const factsX = MARGIN + qrSize + 50;
  const factsWidth = WIDTH - factsX - MARGIN;
  write(`${text.numberLabel.ta} · ${text.numberLabel.en}`, 24, 400, party.textSecondary, 'left', factsX, factsWidth);
  ctx.font = `40px ${monoFontFamily}`;
  ctx.fillStyle = party.text;
  ctx.textAlign = 'left';
  ctx.fillText(text.reference, factsX, y + 10);
  y += 80;
  write(text.issued.ta, 26, 400, party.textSecondary, 'left', factsX, factsWidth);
  write(text.issued.en, 26, 400, party.textSecondary, 'left', factsX, factsWidth);
  write(`${text.check.ta} · ${text.check.en}`, 24, 600, party.primary, 'left', factsX, factsWidth);
  y = HEIGHT - MARGIN - 40;
  write(`${text.noId.ta} ${text.noId.en}`, 20, 400, party.textSecondary);

  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1] ?? '';
}

function wrap(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string[] {
  const words = line.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawQr(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number): void {
  const code = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const count = code.modules.size + 8; // four modules of quiet zone on each side
  const cell = size / count;
  ctx.fillStyle = party.card;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = party.text;
  for (let row = 0; row < code.modules.size; row += 1) {
    for (let column = 0; column < code.modules.size; column += 1) {
      if (code.modules.get(row, column)) {
        ctx.fillRect(x + (column + 4) * cell, y + (row + 4) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
}
