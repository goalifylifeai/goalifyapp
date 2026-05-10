import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, type SphereId } from '../../constants/theme';
import { F } from '../../components/ui';
import { SphereSelectStep } from '../../components/ritual/SphereSelectStep';
import { ActionPickStep } from '../../components/ritual/ActionPickStep';
import { LockConfirmStep } from '../../components/ritual/LockConfirmStep';
import { useDailyRitual, type RitualAction } from '../../store/daily-ritual';
import { useStore } from '../../store';
import { proposeMorningActions } from '../../lib/ritual-coach';
import { onMorningLocked } from '../../lib/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STEPS = 3;

export default function MorningRitualScreen() {
  const router = useRouter();
  const { isMorningDone, yesterdayNextSphere, lockMorning } = useDailyRitual();
  const { state } = useStore();

  const [step, setStep] = useState(0);
  const [sphere, setSphere] = useState<SphereId | null>(yesterdayNextSphere ?? null);
  const [actions, setActions] = useState<RitualAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const translateX = useRef(new Animated.Value(0)).current;

  const goToStep = (next: number) => {
    Animated.timing(translateX, {
      toValue: -next * SCREEN_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setStep(next));
  };

  const handleSphereNext = () => {
    if (!sphere) return;
    const proposed = proposeMorningActions(sphere, state.goals, state.habits);
    setActions(proposed);
    goToStep(1);
  };

  const handleToggleMustDo = (id: string) => {
    setActions(prev => prev.map(a => ({ ...a, is_must_do: a.id === id })));
  };

  const handleSwap = (id: string) => {
    if (!sphere) return;
    const fresh = proposeMorningActions(sphere, state.goals, state.habits);
    setActions(prev => {
      const idx = prev.findIndex(a => a.id === id);
      if (idx === -1) return prev;
      const replacement = fresh.find(f => !prev.some(p => p.text === f.text)) ?? fresh[0];
      const next = [...prev];
      next[idx] = { ...replacement, is_must_do: false };
      return next;
    });
  };

  const handleLock = async () => {
    if (!sphere || actions.length === 0) return;
    const hasMustDo = actions.some(a => a.is_must_do);
    if (!hasMustDo) return;

    goToStep(2);
    setSaving(true);
    const { error } = await lockMorning(sphere, actions);
    setSaving(false);
    if (error) { setSaveError(error); return; }

    const mustDoDone = actions.some(a => a.is_must_do && a.done);
    await onMorningLocked(mustDoDone).catch(() => {});

    setTimeout(() => router.replace('/(tabs)/'), 1400);
  };

  if (isMorningDone) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 28, color: COLORS.ink1, textAlign: 'center', marginBottom: 16 }}>
          You've already set your day.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/')}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Back to today →
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const canAdvanceStep0 = sphere !== null;
  const canAdvanceStep1 = actions.some(a => a.is_must_do);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.paper }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              backgroundColor: i <= step ? COLORS.ink1 : COLORS.ink6,
            }} />
          ))}
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink4 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Sliding steps */}
      <Animated.View style={{ flex: 1, flexDirection: 'row', width: SCREEN_WIDTH * STEPS, transform: [{ translateX }] }}>
        <View style={{ width: SCREEN_WIDTH }}>
          <SphereSelectStep
            selected={sphere}
            onSelect={setSphere}
            preSelected={yesterdayNextSphere}
          />
        </View>
        <View style={{ width: SCREEN_WIDTH }}>
          {step >= 1 && (
            <ActionPickStep
              actions={actions}
              onToggleMustDo={handleToggleMustDo}
              onSwap={handleSwap}
            />
          )}
        </View>
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {step === 2 && sphere && (
            <LockConfirmStep sphere={sphere} saving={saving} error={saveError} />
          )}
        </View>
      </Animated.View>

      {/* CTA button */}
      {step < 2 && (
        <View style={{ paddingHorizontal: 22, paddingBottom: 32, paddingTop: 12 }}>
          <TouchableOpacity
            onPress={step === 0 ? handleSphereNext : handleLock}
            disabled={step === 0 ? !canAdvanceStep0 : !canAdvanceStep1}
            style={{
              backgroundColor: (step === 0 ? canAdvanceStep0 : canAdvanceStep1) ? COLORS.ink1 : COLORS.ink6,
              borderRadius: 50, paddingVertical: 16, alignItems: 'center',
            }}
          >
            <Text style={{
              fontFamily: F.mono, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
              color: (step === 0 ? canAdvanceStep0 : canAdvanceStep1) ? COLORS.paper : COLORS.ink4,
            }}>
              {step === 0 ? 'Set my focus →' : 'Lock the day →'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
