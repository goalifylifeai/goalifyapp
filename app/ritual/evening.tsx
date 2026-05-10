import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, type SphereId } from '../../constants/theme';
import { SPHERE_LIST } from '../../constants/data';
import { F } from '../../components/ui';
import { DoneReviewStep } from '../../components/ritual/DoneReviewStep';
import { JournalLineStep } from '../../components/ritual/JournalLineStep';
import { TomorrowPickStep } from '../../components/ritual/TomorrowPickStep';
import { CloseCelebrationStep } from '../../components/ritual/CloseCelebrationStep';
import { useDailyRitual } from '../../store/daily-ritual';
import { onEveningClosed } from '../../lib/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STEPS = 4;

const SCREEN_LABELS = ['Review', 'Reflect', 'Tomorrow', 'Close'];

export default function EveningRitualScreen() {
  const router = useRouter();
  const { intention, isMorningDone, isEveningDone, toggleRitualAction, closeEvening } = useDailyRitual();

  const [step, setStep] = useState(0);
  const [journalLine, setJournalLine] = useState('');
  const [nextSphere, setNextSphere] = useState<SphereId | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const translateX = useRef(new Animated.Value(0)).current;

  const goToStep = (next: number) => {
    Animated.timing(translateX, {
      toValue: -next * SCREEN_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start(() => setStep(next));
  };

  const handleNext = () => goToStep(Math.min(step + 1, STEPS - 1));

  const handleClose = async () => {
    if (!intention) return;
    const sphere = nextSphere ?? SPHERE_LIST[0];

    goToStep(3);
    setSaving(true);
    const { error } = await closeEvening(journalLine.trim(), sphere);
    setSaving(false);
    if (error) { setSaveError(error); return; }
    await onEveningClosed().catch(() => {});
  };

  if (!isMorningDone || !intention) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 26, color: COLORS.ink1, textAlign: 'center', marginBottom: 16 }}>
          Set your morning ritual first.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/ritual/morning')}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Start morning →
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sphere = intention.focus_sphere as SphereId;
  const mustDoDone = intention.must_do_done;

  const ctaLabel = step === 2 ? 'Close the day →' : step === 3 ? 'Done' : 'Next →';

  const handleCta = () => {
    if (step === 0) { handleNext(); }
    else if (step === 1) { handleNext(); }
    else if (step === 2) { handleClose(); }
    else { router.replace('/(tabs)/'); }
  };

  const ctaDisabled = step === 3 && saving;

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
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink4 }}>
          {SCREEN_LABELS[step]}
        </Text>
        {step < 3 && (
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink4 }}>✕</Text>
          </TouchableOpacity>
        )}
        {step === 3 && <View style={{ width: 24 }} />}
      </View>

      {/* Sliding screens */}
      <Animated.View style={{ flex: 1, flexDirection: 'row', width: SCREEN_WIDTH * STEPS, transform: [{ translateX }] }}>
        <View style={{ width: SCREEN_WIDTH }}>
          <DoneReviewStep
            actions={intention.actions}
            onToggle={toggleRitualAction}
          />
        </View>
        <View style={{ width: SCREEN_WIDTH }}>
          {step >= 1 && (
            <JournalLineStep
              sphere={sphere}
              mustDoDone={mustDoDone}
              value={journalLine}
              onChange={setJournalLine}
            />
          )}
        </View>
        <View style={{ width: SCREEN_WIDTH }}>
          {step >= 2 && (
            <TomorrowPickStep
              selected={nextSphere}
              onSelect={setNextSphere}
            />
          )}
        </View>
        <View style={{ width: SCREEN_WIDTH }}>
          {step === 3 && (
            <CloseCelebrationStep
              sphere={sphere}
              journalLine={journalLine}
              saving={saving}
              error={saveError}
            />
          )}
        </View>
      </Animated.View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 32, paddingTop: 12 }}>
        <TouchableOpacity
          onPress={handleCta}
          disabled={ctaDisabled}
          style={{
            backgroundColor: ctaDisabled ? COLORS.ink6 : COLORS.ink1,
            borderRadius: 50, paddingVertical: 16, alignItems: 'center',
          }}
        >
          <Text style={{
            fontFamily: F.mono, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
            color: ctaDisabled ? COLORS.ink4 : COLORS.paper,
          }}>
            {ctaLabel}
          </Text>
        </TouchableOpacity>
        {step === 1 && (
          <TouchableOpacity onPress={handleNext} style={{ paddingTop: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink4, letterSpacing: 1 }}>
              Skip journal
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
