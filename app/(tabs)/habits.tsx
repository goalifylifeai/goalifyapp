import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST } from '../../constants/data';
import { SectionLabel, Card, Heatmap, Pill, F } from '../../components/ui';
import { useStore } from '../../store';
import type { SphereId } from '../../constants/theme';
import { exportHabitToCalendar } from '../../lib/calendar';

const TIMEFRAMES = [
  { label: '4W', weeks: 4 },
  { label: '8W', weeks: 8 },
  { label: '12W', weeks: 12 },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const CALENDAR_SYNC_KEY = '@goalify/calendar_sync';

const ICONS = ['◐', '△', '▭', '◇', '○', '◔', '◯', '⌬'];

export default function HabitsScreen() {
  const { state, dispatch } = useStore();
  const habits = state.habits;

  const [weeks, setWeeks] = useState(12);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSphere, setNewSphere] = useState<SphereId>('health');
  const [newTarget, setNewTarget] = useState('');
  const [newIcon, setNewIcon] = useState('○');

  const toggle = (id: string) => dispatch({ type: 'TOGGLE_HABIT', id });

  const { heatmapValues, globalStreak, activeDays, completionPct } = useMemo(() => {
    const totalDays = weeks * 7;
    const heatmapValues: number[] = [];

    let activeDays = 0;
    let totalRatio = 0;

    for (let i = totalDays - 1; i >= 0; i--) {
      const dateStr = isoDate(daysAgo(i));
      if (habits.length === 0) {
        heatmapValues.push(0);
        continue;
      }
      const done = habits.filter(h => (h.history ?? []).includes(dateStr)).length;
      const ratio = done / habits.length;
      if (done > 0) activeDays++;
      totalRatio += ratio;
      heatmapValues.push(ratio === 0 ? 0 : ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio < 1 ? 3 : 4);
    }

    const completionPct = habits.length > 0 ? Math.round((totalRatio / totalDays) * 100) : 0;

    // Global streak: consecutive days (ending today) where ≥1 habit done
    let globalStreak = 0;
    if (habits.length > 0) {
      const cur = new Date();
      const todayStr = isoDate(cur);
      const anyDoneToday = habits.some(h => (h.history ?? []).includes(todayStr));
      if (!anyDoneToday) cur.setDate(cur.getDate() - 1);
      while (true) {
        const dateStr = isoDate(cur);
        const anyDone = habits.some(h => (h.history ?? []).includes(dateStr));
        if (!anyDone) break;
        globalStreak++;
        cur.setDate(cur.getDate() - 1);
      }
    }

    return { heatmapValues, globalStreak, activeDays, completionPct };
  }, [habits, weeks]);

  const saveHabit = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const habit = {
      id: `h-${Date.now()}`,
      label,
      icon: newIcon,
      sphere: newSphere,
      streak: 0,
      target: newTarget.trim() || '1 session',
      doneToday: false,
    };
    dispatch({ type: 'ADD_HABIT', habit });
    setNewLabel('');
    setNewTarget('');
    setNewIcon('○');
    setAdding(false);

    const syncEnabled = await AsyncStorage.getItem(CALENDAR_SYNC_KEY);
    if (syncEnabled === '1') {
      exportHabitToCalendar(habit).then(eventId => {
        dispatch({ type: 'SET_HABIT_CALENDAR_ID', id: habit.id, calendarEventId: eventId });
      }).catch(() => {});
    }
  };

  const cancelAdd = () => { setNewLabel(''); setNewTarget(''); setAdding(false); };

  const completedToday = habits.filter(h => h.doneToday).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          {completedToday}/{habits.length} done today
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8 }}>
          Habits.
        </Text>
      </View>

      {/* Heatmap */}
      <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 6 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>Completion</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {TIMEFRAMES.map(tf => (
            <TouchableOpacity
              key={tf.weeks}
              onPress={() => setWeeks(tf.weeks)}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
                backgroundColor: weeks === tf.weeks ? COLORS.ink1 : 'transparent',
                borderWidth: 1, borderColor: weeks === tf.weeks ? COLORS.ink1 : COLORS.ink5,
              }}
            >
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: weeks === tf.weeks ? COLORS.paper : COLORS.ink3 }}>{tf.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={18}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View>
              <Text style={{ fontFamily: F.display, fontSize: 48, color: COLORS.ink1, lineHeight: 52, letterSpacing: -0.8 }}>
                {habits.length === 0 ? '—' : globalStreak}
              </Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, letterSpacing: 0.5, marginTop: 4 }}>day streak</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, letterSpacing: 0.5 }}>{activeDays}-day total</Text>
              <Text style={{ fontFamily: F.display, fontSize: 26, color: COLORS.ink1, lineHeight: 30, marginTop: 6 }}>
                {habits.length === 0 ? '—' : `${completionPct}%`}
              </Text>
            </View>
          </View>
          <Heatmap values={heatmapValues} weeks={weeks} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>
              {(() => { const d = daysAgo(weeks * 7 - 1); return d.toLocaleString('en', { month: 'short' }); })()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>less</Text>
              {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map((c, i) => (
                <View key={i} style={{ width: 9, height: 9, backgroundColor: c, borderRadius: 2 }} />
              ))}
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>more</Text>
            </View>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>
              {new Date().toLocaleString('en', { month: 'short' })}
            </Text>
          </View>
        </Card>
      </View>

      {/* Habit list */}
      <SectionLabel action="+ New" onAction={() => setAdding(true)}>Daily habits</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        {habits.map(h => {
          const s = SPHERE_COLORS[h.sphere];
          return (
            <Card key={h.id} pad={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity
                  onPress={() => toggle(h.id)}
                  style={{
                    width: 42, height: 42, borderRadius: 12,
                    backgroundColor: h.doneToday ? s.accent : s.soft,
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: h.doneToday ? 'white' : s.deep, fontSize: h.doneToday ? 18 : 16 }}>
                    {h.doneToday ? '✓' : h.icon}
                  </Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink1, fontWeight: '500', letterSpacing: -0.2 }}>{h.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>{h.target}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink4, opacity: 0.4 }}>·</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>{s.label}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.display, fontSize: 28, color: COLORS.ink1, lineHeight: 32 }}>{h.streak}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink3, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>day streak</Text>
                </View>
              </View>
              {/* 14-day bar */}
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 14 }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <View key={i} style={{
                    flex: 1, height: 6, borderRadius: 2,
                    backgroundColor: i < (h.streak >= 14 ? 14 : h.streak) ? s.accent : COLORS.ink6,
                  }} />
                ))}
              </View>
            </Card>
          );
        })}

        {/* Add habit form */}
        {adding && (
          <Card pad={18}>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>New habit</Text>

            {/* Sphere picker */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 14 }}>
              {SPHERE_LIST.map(id => (
                <Pill key={id} active={newSphere === id} onPress={() => setNewSphere(id)}>
                  <Text style={{ color: newSphere === id ? COLORS.paper : SPHERE_COLORS[id].deep }}>{SPHERE_COLORS[id].glyph} </Text>
                  {SPHERE_COLORS[id].label}
                </Pill>
              ))}
            </ScrollView>

            <TextInput
              autoFocus
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Habit name"
              placeholderTextColor={COLORS.ink4}
              style={{ fontFamily: undefined, fontSize: 15, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}
            />

            <TextInput
              value={newTarget}
              onChangeText={setNewTarget}
              placeholder="Daily target (e.g. 30 min)"
              placeholderTextColor={COLORS.ink4}
              style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 14 }}
            />

            {/* Icon picker */}
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 8 }}>Icon</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  onPress={() => setNewIcon(icon)}
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: newIcon === icon ? COLORS.ink1 : COLORS.ink7,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, color: newIcon === icon ? COLORS.paper : COLORS.ink2 }}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity onPress={cancelAdd} style={{ padding: 8 }}>
                <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveHabit}
                style={{ backgroundColor: COLORS.ink1, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 99 }}
              >
                <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.paper, fontWeight: '500' }}>Save habit</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
