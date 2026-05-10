import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SPHERE_COLORS, type SphereId } from '../../constants/theme';
import { F } from '../ui';

interface Props {
  sphere: SphereId;
  saving: boolean;
  error: string | null;
}

export function LockConfirmStep({ sphere, saving, error }: Props) {
  const s = SPHERE_COLORS[sphere];
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!saving && !error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [saving, error]);

  if (saving) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ink1 }}>
        <ActivityIndicator color={COLORS.paper} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.paper, padding: 32 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3, textAlign: 'center', letterSpacing: 1 }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ink1, padding: 32 }}>
      <Animated.View style={{ alignItems: 'center', gap: 20, transform: [{ scale }], opacity }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: s.soft,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 36 }}>✓</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(244,239,230,0.5)' }}>
            {s.label} focus
          </Text>
          <Text style={{ fontFamily: F.displayItalic, fontSize: 34, color: COLORS.paper, textAlign: 'center', letterSpacing: -0.4, lineHeight: 42 }}>
            Locked. Make it count.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
