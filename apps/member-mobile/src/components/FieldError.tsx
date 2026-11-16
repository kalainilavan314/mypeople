import { AppText } from '@my-people/mobile-ui';

/** The error under a field that is not a TextField (chips, a checkbox), announced when it appears. */
export function FieldError({ text }: { text: string }) {
  return (
    <AppText step="secondary" tone="error" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {text}
    </AppText>
  );
}
