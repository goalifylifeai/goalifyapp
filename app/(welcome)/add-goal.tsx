import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '../../components/DateTimePicker';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import type { SphereId } from '../../constants/theme';
import { F } from '../../components/ui';
import { HabitPromptModal } from '../../components/HabitPromptModal';
import { useStore } from '../../store';
import { useOnboarding } from '../../store/onboarding';
import { newId } from '../../lib/id';
import { localDateISO, formatDisplayDate } from '../../lib/date';
import { track } from '../../lib/analytics';

const SPHERES = Object.keys(SPHERE_COLORS) as SphereId[];

export default function WelcomeAddGoal() {
  const insets = useSafeAreaInsets();
  const { state: onboarding, advance } = useOnboarding();
  const { dispatch } = useStore();

  const [sphere, setSphere] = useState<SphereId>('career');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [habitPrompt, setHabitPrompt] = useState<{ goalId: string; sphere: SphereId; title: string } | null>(null);

  const name = onboarding?.selections?.display_name?.split(' ')[0] ?? 'there';

  const goToAddTask = (goalId: string, t: string) => {
    router.replace({ pathname: '/(welcome)/add-task', params: { goalId, goalTitle: t, sphere } });
  };

  const save = async () => {
    const t = title.trim();
    if (!t) return;

    // Ensure the sphere is in onboarding selections
    const currentSpheres = onboarding?.selections?.spheres ?? [];
    if (!currentSpheres.includes(sphere)) {
      await advance('spheres', [...currentSpheres, sphere]);
    }

    const goalId = newId();
    dispatch({
      type: 'ADD_GOAL',
      goal: { id: goalId, sphere, title: t, due: localDateISO(due), progress: 0, sub: [] },
    });
    track('welcome_goal_step', { action: 'saved', sphere });
    setHabitPrompt({ goalId, sphere, title: t });
  };

  const saveHabitForGoal = (label: string) => {
    if (!habitPrompt) return;
    dispatch({
      type: 'ADD_HABIT',
      habit: {
        id: newId(),
        label,
        icon: '○',
        sphere: habitPrompt.sphere,
        streak: 0,
        target: '1 session',
        doneToday: false,
        goalId: habitPrompt.goalId,
      },
    });
    const { goalId, title: t } = habitPrompt;
    setHabitPrompt(null);
    goToAddTask(goalId, t);
  };

  const skipHabitPrompt = () => {
    if (!habitPrompt) return;
    const { goalId, title: t } = habitPrompt;
    setHabitPrompt(null);
    goToAddTask(goalId, t);
  };

  const skip = () => {
    track('welcome_goal_step', { action: 'skipped' });
    router.replace('/(tabs)');
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    // Only Android's modal dialog closes on pick. On web, Chrome fires a change on
    // month-arrow clicks, so hiding here would close the calendar mid-browse.
    setShowDatePicker(Platform.OS !== 'android');
    if (selectedDate) {
      setDue(selectedDate);
    }
  };

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
          <View style={{ height: 3, flex: 1, borderRadius: 99, backgroundColor: COLORS.ink6 }} />
        </View>

        {/* What the app is */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
          You're in, {name}.
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, lineHeight: 44, letterSpacing: -0.5, marginBottom: 16 }}>
          Goals drive{'\n'}everything here.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, lineHeight: 19, letterSpacing: 0.2, marginBottom: 36 }}>
          Goalify works like this: you set a goal, break it into tasks, and check in daily. Your coach watches the patterns and keeps you honest.
        </Text>

        {/* Sphere picker */}
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
          Which area of life?
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 24 }}>
          {SPHERES.map(id => {
            const s = SPHERE_COLORS[id];
            const active = sphere === id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => setSphere(id)}
                style={{
                  width: 90, height: 160, borderRadius: 45,
                  justifyContent: 'center', alignItems: 'center', gap: 10,
                  backgroundColor: active ? s.accent : COLORS.surface,
                  borderWidth: 1, borderColor: active ? s.accent : COLORS.ink6,
                }}
              >
                <Text style={{ fontSize: 16, color: active ? '#fff' : s.deep }}>{s.glyph}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, color: active ? '#fff' : COLORS.ink2, textAlign: 'center' }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Goal title */}
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
          Name your first goal
        </Text>
        <View style={{
          borderRadius: 14, backgroundColor: COLORS.surface,
          borderWidth: 1, borderColor: COLORS.ink6, padding: 16, marginBottom: 20,
        }}>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Save £10k this year"
            placeholderTextColor={COLORS.ink4}
            returnKeyType="next"
            style={{
              fontFamily: F.display, fontSize: 22, color: COLORS.ink1,
              lineHeight: 28, letterSpacing: -0.2,
            }}
          />
        </View>

        {/* Due date picker */}
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
          Target date
        </Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={{
            borderRadius: 14, backgroundColor: COLORS.surface,
            borderWidth: 1, borderColor: COLORS.ink6, padding: 16, marginBottom: 32,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: F.display, fontSize: 18, color: COLORS.ink1 }}>
            {formatDisplayDate(localDateISO(due))}
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>CHANGE</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={due}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onDateChange}
          />
        )}

        <TouchableOpacity
          onPress={save}
          disabled={!title.trim()}
          style={{
            paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.ink1,
            alignItems: 'center', opacity: title.trim() ? 1 : 0.4,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 1, color: COLORS.paper }}>
            Set this goal →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skip} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>
            Skip — I'll add goals later
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <HabitPromptModal
        visible={!!habitPrompt}
        goalTitle={habitPrompt?.title ?? ''}
        onSave={saveHabitForGoal}
        onSkip={skipHabitPrompt}
      />
    </KeyboardAvoidingView>
  );
}

