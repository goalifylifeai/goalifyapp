import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { F, Ring } from '../components/ui';
import { LEVELS, levelFromXp } from '../constants/data';
import { useStore } from '../store';
import { SPHERE_LIST } from '../constants/data';

export default function LevelInfoScreen() {
  const insets = useSafeAreaInsets();
  const { state } = useStore();

  const sphereData = SPHERE_LIST.reduce((acc, id) => {
    const goals = state.goals.filter(g => g.sphere === id);
    const avg = goals.length > 0
      ? goals.reduce((s, g) => s + g.progress, 0) / goals.length
      : 0;
    acc[id] = avg;
    return acc;
  }, {} as Record<string, number>);

  const overall = Math.round(
    Object.values(sphereData).reduce((s, p) => s + p, 0) / SPHERE_LIST.length * 100,
  );

  const lvl = levelFromXp(overall * 50);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.ink1 }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ position: 'absolute', top: insets.top + 12, right: 20, zIndex: 10, padding: 8 }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: 'rgba(255,255,255,0.45)' }}>CLOSE</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: 28, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
          Your level
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 38, color: COLORS.paper, lineHeight: 44, letterSpacing: -0.8, marginBottom: 10 }}>
          Level {lvl.lvl.n}{'\n'}{lvl.lvl.name}.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 22, letterSpacing: 0.1, marginBottom: 32 }}>
          XP is earned by making progress on your goals. Every percentage point of goal progress translates into XP.
        </Text>

        {/* Current progress ring */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Ring value={lvl.pct} size={110} stroke={6} color={COLORS.paper} track="rgba(255,255,255,0.15)">
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: COLORS.paper, fontFamily: F.mono, fontSize: 22 }}>{lvl.lvl.n}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontFamily: F.mono, fontSize: 9, letterSpacing: 1 }}>LVL</Text>
            </View>
          </Ring>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 14 }}>
            {lvl.into.toLocaleString()} / {lvl.next.min.toLocaleString()} XP to Level {lvl.lvl.n + 1}
          </Text>
        </View>

        {/* XP bar */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 6, marginBottom: 36, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(lvl.pct * 100)}%`, height: '100%', backgroundColor: COLORS.paper, borderRadius: 99 }} />
        </View>

        {/* How XP works */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, marginBottom: 28 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
            How XP works
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginBottom: 8 }}>
            · Complete subtasks to grow your goal progress bars.
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginBottom: 8 }}>
            · Your overall life score (0–100) powers your XP.
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 20 }}>
            · Each point of life score = 50 XP.
          </Text>
        </View>

        {/* All levels */}
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
          All levels
        </Text>
        <View style={{ gap: 2 }}>
          {LEVELS.map((l, i) => {
            const isCurrent = l.n === lvl.lvl.n;
            const isPast = l.n < lvl.lvl.n;
            return (
              <View key={l.n} style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 10,
                  backgroundColor: isCurrent ? COLORS.paper : isPast ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{
                    fontFamily: F.mono, fontSize: 13,
                    color: isCurrent ? COLORS.ink1 : isPast ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                  }}>{l.n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: F.display, fontSize: 17,
                    color: isCurrent ? COLORS.paper : isPast ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                    lineHeight: 21,
                  }}>{l.name}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                    {l.min.toLocaleString()} XP
                  </Text>
                </View>
                {isCurrent && (
                  <View style={{ backgroundColor: COLORS.paper, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: COLORS.ink1 }}>YOU</Text>
                  </View>
                )}
                {isPast && (
                  <Text style={{ fontFamily: F.mono, fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>✓</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
