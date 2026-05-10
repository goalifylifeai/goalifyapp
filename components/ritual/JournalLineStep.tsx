import React, { useRef, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, type SphereId } from '../../constants/theme';
import { F } from '../ui';
import { suggestJournalLine } from '../../lib/ritual-coach';

interface Props {
  sphere: SphereId;
  mustDoDone: boolean;
  value: string;
  onChange: (v: string) => void;
}

const MAX = 280;

export function JournalLineStep({ sphere, mustDoDone, value, onChange }: Props) {
  const placeholder = suggestJournalLine(sphere, mustDoDone);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 32, flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontFamily: F.displayItalic, fontSize: 34, color: COLORS.ink1, letterSpacing: -0.6, lineHeight: 42, marginBottom: 8 }}>
          One line.{'\n'}How was today?
        </Text>
        <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink3, lineHeight: 22, marginBottom: 40 }}>
          Optional. Skip if you'd rather not.
        </Text>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={v => onChange(v.slice(0, MAX))}
          placeholder={placeholder}
          placeholderTextColor={COLORS.ink5}
          multiline
          style={{
            fontFamily: F.displayItalic,
            fontSize: 22,
            color: COLORS.ink1,
            lineHeight: 30,
            letterSpacing: -0.2,
            minHeight: 80,
          }}
          textAlignVertical="top"
        />

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4, letterSpacing: 1 }}>
            {value.length}/{MAX}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
