import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPHERE_COLORS } from '../constants/theme';
import { F, Ring, Bar } from '../components/ui';
import { SPHERE_LIST } from '../constants/data';
import { useStore } from '../store';

const BANDS = [
  { label: 'Thriving', range: '80 – 100', color: SPHERE_COLORS.health.accent, desc: 'All spheres pulling together. Keep the momentum.' },
  { label: 'Steady',   range: '65 – 79',  color: SPHERE_COLORS.career.accent,  desc: 'Solid ground. One or two spheres ready to grow.' },
  { label: 'Building', range: '50 – 64',  color: SPHERE_COLORS.finance.accent, desc: 'Good foundations. More consistency unlocks the next tier.' },
  { label: 'Tending',  range: '0 – 49',   color: SPHERE_COLORS.relationships.accent, desc: 'Some spheres need attention. Start with the lowest bar.' },
];

export default function ScoreInfoScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useStore();

  const sphereData = SPHERE_LIST.reduce((acc, id) => {
    const goals = state.goals.filter(g => g.sphere === id);
    const avg = goals.length > 0
      ? goals.reduce((s, g) => s + g.progress, 0) / goals.length
      : 0;
    acc[id] = { count: goals.length, progress: avg };
    return acc;
  }, {} as Record<string, { count: number; progress: number }>);

  const overall = Math.round(
    Object.values(sphereData).reduce((s, d) => s + d.progress, 0) / SPHERE_LIST.length * 100,
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.paper }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 12, right: 20, zIndex: 10, padding: 8 }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: COLORS.ink3 }}>CLOSE</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: 28, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>
          How it works
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.ink1, lineHeight: 44, letterSpacing: -0.8, marginBottom: 10 }}>
          Your life{'\n'}score.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 13, color: COLORS.ink2, lineHeight: 22, letterSpacing: 0.1, marginBottom: 32 }}>
          One number that reflects how much progress you're making across all four life spheres — not a grade, just a mirror.
        </Text>

        {/* Formula */}
        <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 28, gap: 10 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 4 }}>
            The formula
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2, lineHeight: 20 }}>
            1. Each <Text style={{ color: COLORS.ink1, fontWeight: '600' }}>goal</Text> has a progress bar (0 → 1) based on its completed subtasks.
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2, lineHeight: 20 }}>
            2. Each <Text style={{ color: COLORS.ink1, fontWeight: '600' }}>sphere score</Text> is the average of all goal progress bars in that sphere.
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink2, lineHeight: 20 }}>
            3. The <Text style={{ color: COLORS.ink1, fontWeight: '600' }}>overall score</Text> is the average of all four sphere scores × 100.
          </Text>
        </View>

        {/* Your spheres right now */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 14 }}>
          Your spheres now
        </Text>
        <View style={{ gap: 12, marginBottom: 32 }}>
          {SPHERE_LIST.map(id => {
            const s = SPHERE_COLORS[id];
            const d = sphereData[id];
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: s.soft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: s.deep, fontSize: 14 }}>{s.glyph}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, fontWeight: '500' }}>{s.label}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>
                      {Math.round(d.progress * 100)} · {d.count} {d.count === 1 ? 'goal' : 'goals'}
                    </Text>
                  </View>
                  <Bar value={d.progress} color={s.accent} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Current score */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Ring value={overall / 100} size={100} stroke={6}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: F.display, fontSize: 32, color: COLORS.ink1, letterSpacing: -0.6 }}>{overall}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink3, letterSpacing: 2 }}>/ 100</Text>
            </View>
          </Ring>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, marginTop: 12 }}>your overall score today</Text>
        </View>

        {/* Bands */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 14 }}>
          Score bands
        </Text>
        <View style={{ gap: 10, marginBottom: 8 }}>
          {BANDS.map(b => (
            <View key={b.label} style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: 14,
              padding: 14, borderRadius: 12,
              backgroundColor: overall >= parseInt(b.range) ? COLORS.surface : 'transparent',
              borderWidth: 1,
              borderColor: overall >= parseInt(b.range) ? COLORS.ink7 : COLORS.ink7,
            }}>
              <View style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', backgroundColor: b.color }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '600' }}>{b.label}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>{b.range}</Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2, lineHeight: 17 }}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
