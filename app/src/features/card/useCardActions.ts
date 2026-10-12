import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { useRef, useState } from 'react';
import { CREDENTIAL_HEIGHT, CREDENTIAL_WIDTH } from './components/MembershipCredential';

export function useCardActions() {
  const t = useWorkspaceText();
  const cardHost = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const downloadPdf = async () => {
    const el = cardHost.current?.querySelector<HTMLElement>('.membership-credential');
    if (!el || pdfBusy) return;
    setPdfBusy(true);
    setFeedback('');
    try {
      await document.fonts.ready;
      await Promise.all([...el.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
      const started = Date.now();
      while (el.querySelector('canvas[data-ready="false"]') && Date.now() - started < 4000)
        await new Promise((resolve) => setTimeout(resolve, 50));
      if (el.querySelector('canvas[data-ready="false"]')) throw new Error('QR still preparing');
      const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const png = await toPng(el, {
        width: CREDENTIAL_WIDTH,
        height: CREDENTIAL_HEIGHT,
        pixelRatio: 3.146,
        preferredFontFormat: 'woff2',
        cacheBust: false,
        style: { transform: 'none' },
        backgroundColor: '#f7fbff',
      });
      const widthMm = 85.6,
        heightMm = (widthMm * 1000) / 1573;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [widthMm, heightMm],
        compress: true,
      });
      pdf.addImage(png, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      const file = new File([pdf.output('blob')], 'my-people-membership-id.pdf', {
        type: 'application/pdf',
      });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: 'My People Membership ID' });
      else {
        const url = URL.createObjectURL(file),
          a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      setFeedback(
        t(
          'Your PDF is ready. Its QR has the same short-lived validity as the displayed code.',
          'உங்கள் PDF தயார். அதிலுள்ள QR தற்போது காட்டப்படும் குறியீட்டின் அதே குறுகிய காலச் செல்லுபடியைக் கொண்டது.',
        ),
      );
    } catch (err) {
      console.warn('Membership PDF export failed', err);
      if (!(err instanceof Error && err.name === 'AbortError'))
        setFeedback(
          t(
            'Could not create the PDF. Please try again.',
            'PDF உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
          ),
        );
    } finally {
      setPdfBusy(false);
    }
  };
  const copyReferral = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback(t('Referral ID copied.', 'அழைப்புக் குறியீடு நகலெடுக்கப்பட்டது.'));
    } catch {
      setFeedback(
        t(
          'Could not copy the referral ID. Please try again.',
          'அழைப்புக் குறியீட்டை நகலெடுக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        ),
      );
    }
  };
  return { cardHost, pdfBusy, feedback, downloadPdf, copyReferral };
}
