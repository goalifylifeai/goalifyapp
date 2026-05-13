import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST, levelFromXp } from '../../constants/data';
import { SectionLabel, Card, SphereChip, Ring, Bar, Check, Pill, F } from '../../components/ui';
import { useStore } from '../../store';
import { useFutureSelf } from '../../store/future-self';
import { useDailyRitual } from '../../store/daily-ritual';
import { useProfile } from '../../store/profile';
import type { SphereId } from '../../constants/theme';

function formatToday() {
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatNextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

export default function TodayScreen() {
  const { profile } = useProfile();
  const { state, dispatch } = useStore();
  const { originalLetter } = useFutureSelf();
  const { intention, isMorningDone, isEveningDone, toggleRitualAction } = useDailyRitual();
  const router = useRouter();

  const ritualActions = intention?.actions ?? [];
  const freeActions = state.todayActions.filter(
    a => !ritualActions.some(r => r.id === a.id),
  );
  const actions = [
    ...ritualActions.map(r => ({
      id: r.id, t: r.text, sphere: r.sphere as SphereId,
      time: '', done: r.done, goal: '', _isMustDo: r.is_must_do, _isRitual: true as const,
    })),
    ...freeActions.map(a => ({ ...a, _isMustDo: false, _isRitual: false as const })),
  ];

  // Sphere calculations
  const sphereData = SPHERE_LIST.reduce((acc, id) => {
    const goals = state.goals.filter(g => g.sphere === id);
    const avgProgress = goals.length > 0 
      ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length 
      : 0;
    acc[id] = { count: goals.length, progress: avgProgress };
    return acc;
  }, {} as Record<SphereId, { count: number; progress: number }>);

  const overall = Math.round(
    Object.values(sphereData).reduce((sum, d) => sum + d.progress, 0) / SPHERE_LIST.length * 100
  );

  const lvl = levelFromXp(overall * 50); // Arbitrary XP calculation based on progress
  
  const sortedSpheres = [...SPHERE_LIST].sort((a, b) => sphereData[b].progress - sphereData[a].progress);
  const top = sortedSpheres[0];
  const low = sortedSpheres[sortedSpheres.length - 1];
  
  const band = overall >= 80 ? 'Thriving' : overall >= 65 ? 'Steady' : overall >= 50 ? 'Building' : 'Tending';

  const [addingAction, setAddingAction] = useState(false);
  const [newText, setNewText] = useState('');
  const [newSphere, setNewSphere] = useState<SphereId>('career');

  const nudgeOpacity = useRef(new Animated.Value(0)).current;
  const nudgeShownThisSession = useRef(false);

  const showNudge = () => {
    if (nudgeShownThisSession.current || !originalLetter) return;
    nudgeShownThisSession.current = true;
    Animated.sequence([
      Animated.timing(nudgeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(nudgeOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const toggle = (id: string) => {
    const ritualAction = ritualActions.find(r => r.id === id);
    if (ritualAction) {
      if (ritualAction.done) showNudge();
      toggleRitualAction(id);
      return;
    }
    const action = state.todayActions.find(a => a.id === id);
    if (action?.done) showNudge();
    dispatch({ type: 'TOGGLE_ACTION', id });
  };

  const saveAction = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    dispatch({
      type: 'ADD_ACTION',
      action: {
        id: crypto.randomUUID(),
        t: trimmed,
        sphere: newSphere,
        time: formatNextHour(),
        done: false,
        goal: '',
      },
    });
    setNewText('');
    setAddingAction(false);
  };

  const cancelAdd = () => { setNewText(''); setAddingAction(false); };

  const doneCt = actions.filter(a => a.done).length;

  const nudgeQuote = originalLetter
    ? originalLetter.body.split(/[.!?]/)[0].trim().slice(0, 80)
    : '';

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      {/* Greeting */}
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          {formatToday()}
        </Text>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 42, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8, marginBottom: 16 }}>
          Good morning, {profile?.display_name ?? 'there'}.
        </Text>
        <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink3, lineHeight: 21 }}>
          You've completed{' '}
          <Text style={{ color: COLORS.ink1, fontWeight: '600' }}>{doneCt} of {actions.length}</Text>
          {' '}intentions today. {actions.length - doneCt} remain.
        </Text>
      </View>

      {/* Morning ritual CTA */}
      {!isMorningDone && (
        <TouchableOpacity
          onPress={() => router.push('/ritual/morning' as any)}
          activeOpacity={0.85}
          style={{ marginHorizontal: 22, marginTop: 16 }}
        >
          <View style={{
            backgroundColor: COLORS.accentWarm, borderRadius: 14,
            paddingVertical: 14, paddingHorizontal: 18,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(244,239,230,0.75)' }}>
                Morning ritual
              </Text>
              <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.paper, fontWeight: '600' }}>
                Pick today's One
              </Text>
            </View>
            <Text style={{ fontSize: 22, color: COLORS.paper }}>☀</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Overall life score */}
      <SectionLabel>Overall life score</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/score-info' as any)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ring value={overall / 100} size={86} stroke={5}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: F.display, fontSize: 28, color: COLORS.ink1, letterSpacing: -0.6 }}>{overall}</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink3, letterSpacing: 2 }}>/ 100</Text>
            </View>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 }}>
              Trending · <Text style={{ color: SPHERE_COLORS.finance.accent }}>+4</Text>
            </Text>
            <Text style={{ fontFamily: F.displayItalic, fontSize: 24, color: COLORS.ink2, lineHeight: 28, marginTop: 4, letterSpacing: -0.4 }}>
              {band}.
            </Text>
            <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 6, lineHeight: 17 }}>
              Lifted by{' '}
              <Text style={{ color: SPHERE_COLORS[top].accent, fontWeight: '600' }}>{SPHERE_COLORS[top].label.toLowerCase()}</Text>
              , held back by{' '}
              <Text style={{ color: SPHERE_COLORS[low].accent, fontWeight: '600' }}>{SPHERE_COLORS[low].label.toLowerCase()}</Text>.
            </Text>
            <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 10 }}>
              {SPHERE_LIST.map(id => (
                <View key={id} style={{ flex: 1, backgroundColor: SPHERE_COLORS[id].accent, borderRadius: 2, opacity: 0.85 }} />
              ))}
            </View>
          </View>
        </Card>
        </TouchableOpacity>
      </View>

      {/* Sphere balance */}
      <SectionLabel>Sphere balance</SectionLabel>
      <View style={{ paddingHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {SPHERE_LIST.map(id => {
          const s = SPHERE_COLORS[id];
          const data = sphereData[id];
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/(tabs)/goals', params: { sphere: id } })}
              style={{ width: '47%' }}
            >
              <Card pad={14}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <SphereChip sphere={id} size={26} />
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>
                    {data.count} {data.count === 1 ? 'goal' : 'goals'}
                  </Text>
                </View>
                <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink2, marginTop: 10, fontWeight: '500' }}>{s.label}</Text>
                <Bar value={data.progress} color={s.accent} style={{ marginTop: 6 }} />
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>


      {/* Level + streak */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22, flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity activeOpacity={0.85} style={{ flex: 1 }} onPress={() => router.push('/level-info' as any)}>
          <Card pad={16} style={{ flex: 1, backgroundColor: COLORS.ink1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ring value={lvl.pct} size={42} stroke={3} color={COLORS.paper} track="rgba(255,255,255,0.18)">
                <Text style={{ color: COLORS.paper, fontFamily: F.mono, fontSize: 12 }}>{lvl.lvl.n}</Text>
              </Ring>
              <View>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Level {lvl.lvl.n}</Text>
                <Text style={{ fontFamily: F.display, fontSize: 20, color: COLORS.paper, lineHeight: 24, marginTop: 2 }}>{lvl.lvl.name}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 10, letterSpacing: 0.5 }}>
              {lvl.into.toLocaleString()} / {lvl.next.min.toLocaleString()} XP
            </Text>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={{ flex: 1 }} onPress={() => router.push('/streak-info' as any)}>
          <Card pad={16} style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 }}>Streak</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
              <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, lineHeight: 48 }}>0</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 13, color: COLORS.ink3, marginLeft: 4 }}>days</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <View key={i} style={{
                  flex: 1, height: 10, borderRadius: 2,
                  backgroundColor: COLORS.ink1,
                  opacity: i < 13 ? 0.4 + (i / 13) * 0.6 : 0.12,
                }} />
              ))}
            </View>
          </Card>
        </TouchableOpacity>
      </View>

      {/* Affirmations per goal */}
      <SectionLabel>Affirmations</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 22, paddingRight: 22, gap: 10, paddingBottom: 6 }}>
        {state.goals.length === 0 ? (
          <View style={{ minWidth: 280, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.ink7, backgroundColor: COLORS.surface }}>
            <Text style={{ fontFamily: F.displayItalic, fontSize: 16, color: COLORS.ink3, lineHeight: 22 }}>
              Add your first goal to unlock affirmations.
            </Text>
          </View>
        ) : state.goals.map(g => {
          const s = SPHERE_COLORS[g.sphere];
          return (
            <LinearGradient
              key={g.id}
              colors={[COLORS.paper, COLORS.surfaceWarm]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ minWidth: 280, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.ink7 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <SphereChip sphere={g.sphere} size={20} />
                <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: s.deep }} numberOfLines={1}>
                  for "{g.title.length > 26 ? g.title.slice(0, 24) + '…' : g.title}"
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Text style={{ fontFamily: F.display, fontSize: 30, lineHeight: 22, color: s.accent }}>"</Text>
                <Text style={{ fontFamily: F.displayItalic, fontSize: 16, lineHeight: 22, color: COLORS.ink1, flex: 1, letterSpacing: -0.1 }}>
                  Keep moving forward.
                </Text>
              </View>
            </LinearGradient>
          );
        })}
      </ScrollView>

      {/* Quote of the day */}
      <SectionLabel>A quote to carry</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={22} style={{ backgroundColor: COLORS.ink1 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(244,239,230,0.55)' }}>◯ Quote of the day</Text>
          <Text style={{ fontFamily: F.displayItalic, fontSize: 22, lineHeight: 30, marginTop: 12, color: COLORS.paper, letterSpacing: -0.2 }}>
            "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: 'rgba(244,239,230,0.55)', marginTop: 12, letterSpacing: 0.5 }}>
            — attributed to Will Durant
          </Text>
        </Card>
      </View>

      {/* Today's actions */}
      <SectionLabel action="+ Add" onAction={() => setAddingAction(true)}>Today's actions</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={4}>
          {actions.map((a, i) => {
            const s = SPHERE_COLORS[a.sphere];
            return (
              <View key={a.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                paddingVertical: 14, paddingHorizontal: 14,
                borderBottomWidth: i < actions.length - 1 ? 0.5 : 0,
                borderBottomColor: COLORS.ink7,
                borderLeftWidth: a._isMustDo ? 3 : 0,
                borderLeftColor: s.accent,
              }}>
                <Check done={a.done} sphere={a.sphere} onPress={() => toggle(a.id)} />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: undefined, fontSize: 15, color: COLORS.ink1,
                    textDecorationLine: a.done ? 'line-through' : 'none',
                    opacity: a.done ? 0.5 : 1, letterSpacing: -0.2,
                  }}>{a.t}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: s.deep }}>{s.glyph}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>{s.label}</Text>
                    {a._isMustDo && (
                      <>
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink4 }}>·</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: s.deep }}>★ must-do</Text>
                      </>
                    )}
                    {a.time ? (
                      <>
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink4 }}>·</Text>
                        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>{a.time}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Inline add-action form */}
          {addingAction && (
            <View style={{ padding: 14, borderTopWidth: actions.length > 0 ? 0.5 : 0, borderTopColor: COLORS.ink7 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {SPHERE_LIST.map(id => (
                  <Pill key={id} active={newSphere === id} onPress={() => setNewSphere(id)}>
                    <Text style={{ color: newSphere === id ? COLORS.paper : SPHERE_COLORS[id].deep }}>{SPHERE_COLORS[id].glyph} </Text>
                    {SPHERE_COLORS[id].label}
                  </Pill>
                ))}
              </View>
              <TextInput
                autoFocus
                value={newText}
                onChangeText={setNewText}
                placeholder="What's the next action?"
                placeholderTextColor={COLORS.ink4}
                style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink1, paddingVertical: 6 }}
                onSubmitEditing={saveAction}
                returnKeyType="done"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <TouchableOpacity onPress={cancelAdd} style={{ padding: 8 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveAction}
                  style={{ backgroundColor: COLORS.ink1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 }}
                >
                  <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.paper, fontWeight: '500' }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>
      </View>

      {/* Evening close CTA */}
      {isMorningDone && !isEveningDone && (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <TouchableOpacity
            onPress={() => router.push('/ritual/evening' as any)}
            activeOpacity={0.85}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink4 }}>
                  Evening ritual
                </Text>
                <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink1, fontWeight: '600' }}>
                  Close the day
                </Text>
                <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3, marginTop: 2 }}>
                  Take 60 seconds to reflect
                </Text>
              </View>
              <Text style={{ fontSize: 28 }}>☾</Text>
            </Card>
          </TouchableOpacity>
        </View>
      )}

      {/* Habits ribbon */}
      <SectionLabel>Today's habits</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 22, paddingRight: 22, gap: 8, paddingBottom: 6 }}>
        {state.habits.map(h => {
          const s = SPHERE_COLORS[h.sphere];
          return (
            <TouchableOpacity key={h.id} onPress={() => dispatch({ type: 'TOGGLE_HABIT', id: h.id })}>
              <Card pad={14} style={{ minWidth: 120, opacity: h.doneToday ? 0.65 : 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: h.doneToday ? s.accent : s.soft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: h.doneToday ? '#fff' : s.deep, fontSize: 14 }}>{h.doneToday ? '✓' : h.icon}</Text>
                  </View>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>{h.streak}d</Text>
                </View>
                <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink1, marginTop: 10, lineHeight: 15, fontWeight: '500' }}>{h.label}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, marginTop: 3 }}>{h.target}</Text>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScrollView>

    {/* Habit-break nudge from future self */}
    {originalLetter && (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: 100, left: 16, right: 16,
          backgroundColor: COLORS.ink1, borderRadius: 12, padding: 14,
          opacity: nudgeOpacity,
        }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
          Your future self
        </Text>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 14, color: COLORS.paper, lineHeight: 20, letterSpacing: -0.1 }}>
          "{nudgeQuote}"
        </Text>
      </Animated.View>
    )}
    </View>
  );
}
