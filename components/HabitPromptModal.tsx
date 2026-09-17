import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../constants/theme';
import { F } from './ui';

interface HabitPromptModalProps {
  visible: boolean;
  goalTitle: string;
  onSave: (label: string) => void;
  onSkip: () => void;
}

/**
 * Lightweight popup shown right after a goal is saved, asking for one
 * daily habit to link to it. Manual entry only — no auto-suggestion.
 */
export function HabitPromptModal({ visible, goalTitle, onSave, onSkip }: HabitPromptModalProps) {
  const [label, setLabel] = useState('');

  const save = () => {
    const t = label.trim();
    if (!t) return;
    setLabel('');
    onSave(t);
  };

  const skip = () => {
    setLabel('');
    onSkip();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 28 }}
      >
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 18, padding: 22 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
            Daily habit for “{goalTitle}”
          </Text>
          <Text style={{ fontFamily: F.display, fontSize: 20, color: COLORS.ink1, lineHeight: 26, letterSpacing: -0.3, marginBottom: 16 }}>
            What's one daily habit that moves this forward?
          </Text>
          <TextInput
            autoFocus
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Run 20 minutes"
            placeholderTextColor={COLORS.ink4}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{
              fontFamily: undefined, fontSize: 15, color: COLORS.ink1,
              paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 18,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <TouchableOpacity onPress={skip} style={{ padding: 8 }}>
              <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              disabled={!label.trim()}
              style={{ backgroundColor: COLORS.ink1, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 99, opacity: label.trim() ? 1 : 0.4 }}
            >
              <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.paper, fontWeight: '500' }}>Save habit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
