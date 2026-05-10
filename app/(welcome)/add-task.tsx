import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import type { SphereId } from '../../constants/theme';
import { F } from '../../components/ui';
import { useStore } from '../../store';

export default function WelcomeAddTask() {
  const insets = useSafeAreaInsets();
  const { dispatch } = useStore();
  const { goalId, goalTitle, sphere } = useLocalSearchParams<{
    goalId: string; goalTitle: string; sphere: SphereId;
  }>();

  const [task, setTask] = useState('');
  const sphereColors = SPHERE_COLORS[sphere ?? 'career'];

  const save = () => {
    const t = task.trim();
    if (!t || !goalId) {
      router.replace('/(tabs)');
      return;
    }
    dispatch({ type: 'ADD_SUBTASK', goalId, subtask: { t, done: false } });
    router.replace('/(tabs)');
  };

  const skip = () => router.replace('/(tabs)');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: COLORS.paper }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step indicator */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 32 }}>
          <View style={{ height: 3, flex: 1, borderRadius: 99, backgroundColor: COLORS.ink1 }} />
          <View style={{ height: 3, flex: 1, borderRadius: 99, backgroundColor: COLORS.ink1 }} />
        </View>

        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
          Step 2 of 2
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, lineHeight: 44, letterSpacing: -0.5, marginBottom: 16 }}>
          Tasks make{'\n'}it real.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, lineHeight: 19, letterSpacing: 0.2, marginBottom: 28 }}>
          A goal without tasks is just a wish. Add one concrete step — you can always add more from the Goals tab.
        </Text>

        {/* Goal context pill */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999,
          backgroundColor: sphereColors.soft, alignSelf: 'flex-start', marginBottom: 28,
        }}>
          <Text style={{ fontSize: 13, color: sphereColors.deep }}>{sphereColors.glyph}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: sphereColors.deep, letterSpacing: 0.3 }} numberOfLines={1}>
            {goalTitle}
          </Text>
        </View>

        {/* Task input */}
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
          First task
        </Text>
        <View style={{
          borderRadius: 14, backgroundColor: COLORS.surface,
          borderWidth: 1, borderColor: COLORS.ink6, padding: 16, marginBottom: 12,
        }}>
          <TextInput
            autoFocus
            value={task}
            onChangeText={setTask}
            placeholder="e.g. Open a savings account"
            placeholderTextColor={COLORS.ink4}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{
              fontFamily: F.display, fontSize: 22, color: COLORS.ink1,
              lineHeight: 28, letterSpacing: -0.2,
            }}
          />
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4, marginBottom: 32, lineHeight: 16 }}>
          Keep it small and specific — something you can do this week.
        </Text>

        <TouchableOpacity
          onPress={save}
          disabled={!task.trim()}
          style={{
            paddingVertical: 16, borderRadius: 14,
            backgroundColor: task.trim() ? sphereColors.accent : COLORS.ink1,
            alignItems: 'center', opacity: task.trim() ? 1 : 0.4,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            Add task & go →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skip} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>
            I'll add tasks later
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
