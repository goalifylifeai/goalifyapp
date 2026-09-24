import { forwardRef } from 'react';
import { View, Text, TextInput } from 'react-native';
import { COLORS } from '../constants/theme';
import { F } from './ui';

type Props = React.ComponentProps<typeof TextInput> & { label: string };

// Labelled input shared by the sign-in, sign-up and reset-password screens.
export const AuthField = forwardRef<TextInput, Props>(function AuthField({ label, ...input }, ref) {
  return (
    <View>
      <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: COLORS.ink3, textTransform: 'uppercase' }}>{label}</Text>
      <TextInput
        ref={ref}
        {...input}
        placeholderTextColor={COLORS.ink4}
        style={{
          marginTop: 6,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.ink6,
          fontSize: 16,
          color: COLORS.ink1,
          opacity: input.editable === false ? 0.6 : 1,
        }}
      />
    </View>
  );
});

// Props that make an email field behave: no autocorrect/caps, autofill hints.
export const EMAIL_INPUT = {
  autoCapitalize: 'none',
  autoCorrect: false,
  keyboardType: 'email-address',
  autoComplete: 'email',
  textContentType: 'emailAddress',
  returnKeyType: 'next',
} as const;
