import { Platform, Switch } from 'react-native';

import { colors } from '@my-people/design-tokens/mobile';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

// The web build's switch draws its own teal knob unless told otherwise (react-native-web's
// activeThumbColor, which the native types do not know).
const WEB_THUMB = Platform.OS === 'web' ? ({ activeThumbColor: colors.card } as object) : {};

/** An on/off switch in the app's monochrome style: a charcoal track when on, grey when off, a white knob. */
export function ToggleSwitch({ value, onValueChange, accessibilityLabel, disabled = false }: Props) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ true: colors.primary, false: colors.inputBorder }}
      thumbColor={colors.card}
      ios_backgroundColor={colors.inputBorder}
      {...WEB_THUMB}
    />
  );
}
