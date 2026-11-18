import Ionicons from '@expo/vector-icons/Ionicons';
import type { SurveyAnswerValue, SurveyQuestion } from '@my-people/api-client';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, control, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Checkbox, TextField, useLocalized } from '@my-people/mobile-ui';

import { PREFER_NOT_TO_SAY } from './answers';

// The API's limit on a typed answer (surveys/rules.py TEXT_MAX).
const TEXT_MAX = 1000;
const SCALE = [1, 2, 3, 4, 5] as const;

type Props = {
  question: SurveyQuestion;
  value: SurveyAnswerValue | undefined;
  onChange: (value: SurveyAnswerValue | undefined) => void;
  label: string;
};

/**
 * One question's answer: a single choice, several choices, a 1 to 5 scale or typed text.
 * "Prefer not to say" is offered on sensitive questions only (FR-SRV-002).
 */
export function QuestionInput({ question, value, onChange, label }: Props) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const declined = value === PREFER_NOT_TO_SAY;
  const preferNot = question.sensitive ? (
    <Checkbox label={t('m.surveys.preferNotToSay')} checked={declined} onChange={(checked) => onChange(checked ? PREFER_NOT_TO_SAY : undefined)} />
  ) : null;

  if (question.kind === 'single') {
    return (
      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {question.options.map((option) => (
          <Radio key={option.key} label={localized(option.en, option.ta)} checked={value === option.key} onPress={() => onChange(option.key)} />
        ))}
        {question.sensitive ? (
          <Radio label={t('m.surveys.preferNotToSay')} checked={declined} onPress={() => onChange(PREFER_NOT_TO_SAY)} />
        ) : null}
      </View>
    );
  }

  if (question.kind === 'multiple') {
    const chosen = Array.isArray(value) ? value : [];
    const toggle = (key: string, checked: boolean) => {
      const next = checked ? [...chosen, key] : chosen.filter((item) => item !== key);
      onChange(next.length > 0 ? next : undefined);
    };
    return (
      <View style={styles.group} accessibilityLabel={label}>
        <AppText step="secondary" tone="muted">
          {t('m.surveys.chooseAny')}
        </AppText>
        {question.options.map((option) => (
          <Checkbox
            key={option.key}
            label={localized(option.en, option.ta)}
            checked={chosen.includes(option.key)}
            onChange={(checked) => toggle(option.key, checked)}
          />
        ))}
        {preferNot}
      </View>
    );
  }

  if (question.kind === 'scale') {
    return (
      <View style={styles.group}>
        <AppText step="secondary" tone="muted">
          {t('m.surveys.scaleHint')}
        </AppText>
        <View style={styles.scale} accessibilityRole="radiogroup" accessibilityLabel={label}>
          {SCALE.map((number) => {
            const checked = value === number;
            return (
              <Pressable
                key={number}
                onPress={() => onChange(number)}
                accessibilityRole="radio"
                accessibilityLabel={t('m.surveys.scaleValue', { value: number })}
                accessibilityState={{ checked }}
                aria-checked={checked}
                style={[styles.scaleStep, checked ? styles.scaleChosen : styles.scaleIdle]}>
                {checked ? <Ionicons accessible={false} name="checkmark" size={16} color={colors.onBrandAccent} /> : null}
                <AppText step="card" tone={checked ? 'brandAccent' : 'default'}>
                  {String(number)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {question.sensitive ? (
          <Radio label={t('m.surveys.preferNotToSay')} checked={declined} onPress={() => onChange(PREFER_NOT_TO_SAY)} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <TextField
        label={t('m.surveys.yourAnswer')}
        hint={t('m.surveys.textHint', { max: TEXT_MAX })}
        value={typeof value === 'string' && !declined ? value : ''}
        editable={!declined}
        multiline
        textAlignVertical="top"
        maxLength={TEXT_MAX}
        optional={!question.required}
        onChangeText={(text) => onChange(text === '' ? undefined : text)}
      />
      {preferNot}
    </View>
  );
}

/** One choice of a single-choice question, a radio button with a 44-point target. */
function Radio({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      style={styles.radio}>
      <Ionicons
        accessible={false}
        name={checked ? 'radio-button-on' : 'radio-button-off'}
        size={24}
        color={checked ? colors.primary : colors.controlBorder}
      />
      <AppText step="body" style={styles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[1] },
  radio: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: control.height, paddingVertical: spacing[2] },
  flex: { flex: 1 },
  scale: { flexDirection: 'row', gap: spacing[2] },
  scaleStep: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    minHeight: control.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
  },
  scaleChosen: { backgroundColor: colors.brandYellow, borderColor: colors.brandGold },
  scaleIdle: { backgroundColor: colors.card, borderColor: colors.inputBorder },
});
