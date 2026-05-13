import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F } from '../components/ui';

const DAYS_SHOWN = 28;

export default function StreakInfoScreen() {
  const insets = useSafeAreaInsets();

  const today = new Date();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (DAYS_SHOWN - 1 - i));
    return {
      label: d.toLocaleDateString('en', { weekday: 'narrow' }),
      date: d.getDate(),
      done: false,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.paper }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 12, right: 20, zIndex: 10, padding: 8 }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: COLORS.ink3 }}>CLOSE</Text>
      </TouchableOpacity>

      <View style={{ paddingTop: insets.top + 56, paddingHorizontal: 28 }}>
        {/* Header */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
          Streak
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, lineHeight: 44, letterSpacing: -0.8, marginBottom: 10 }}>
          Keep showing{'\n'}up.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 13, color: COLORS.ink2, lineHeight: 22, letterSpacing: 0.1, marginBottom: 36 }}>
          Your streak grows each day you complete at least one action or ritual. Miss a day and it resets.
        </Text>

        {/* Big number */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Text style={{ fontFamily: F.display, fontSize: 96, color: COLORS.ink1, lineHeight: 100, letterSpacing: -2 }}>0</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 14, color: COLORS.ink3, letterSpacing: 1 }}>days in a row</Text>
        </View>

        {/* 28-day grid */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 14 }}>
          Last {DAYS_SHOWN} days
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {days.map((d, i) => (
            <View key={i} style={{ width: '11.5%', alignItems: 'center', gap: 3 }}>
              <View style={{
                width: '100%', aspectRatio: 1, borderRadius: 6,
                backgroundColor: d.done ? COLORS.ink1 : COLORS.ink7,
              }} />
              <Text style={{ fontFamily: F.mono, fontSize: 8, color: COLORS.ink4 }}>{d.date}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginTop: 32 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
            What counts
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2, lineHeight: 20, marginBottom: 8 }}>
            · Checking off a Today action
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2, lineHeight: 20, marginBottom: 8 }}>
            · Completing your morning ritual
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2, lineHeight: 20 }}>
            · Completing your evening ritual
          </Text>
        </View>
      </View>
    </View>
  );
}
