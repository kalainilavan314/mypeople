import { useEffect, useState } from 'react';

// Fields that bring up the on-screen keyboard. Selects open a picker instead.
const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}

/**
 * True while a text field has focus on a touch device. The keyboard shrinks the
 * layout viewport (interactive-widget=resizes-content), which lifts the fixed
 * bottom bar over the very field being typed in, so the bar steps aside then.
 */
export function useTypingInField(): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const focusIn = (event: FocusEvent) => setTyping(isTextField(event.target));
    // relatedTarget is the element receiving focus next, or null when focus leaves fields.
    const focusOut = (event: FocusEvent) => setTyping(isTextField(event.relatedTarget));
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    return () => {
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, []);

  return typing;
}
