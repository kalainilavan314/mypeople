import { StyleSheet } from 'react-native';

/**
 * The look of the party fund screens, from the payment design the owner chose on 18 November 2026:
 * a soft grey page, white rounded boxes with a faint shadow, near-black pill buttons and a dark
 * account card. It belongs to these screens only; the rest of the app keeps its own theme.
 */
export const fundColors = {
  page: '#efeff1',
  box: '#ffffff',
  ink: '#1c1c1e',
  inkSoft: '#3a3a3c',
  muted: '#6e6e73',
  line: '#e3e3e6',
  onInk: '#ffffff',
} as const;

export const fundStyles = StyleSheet.create({
  box: {
    backgroundColor: fundColors.box,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
});
