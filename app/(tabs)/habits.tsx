import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST, HEATMAP } from '../../constants/data';
import { SectionLabel, Card, Heatmap, Pill, F } from '../../components/ui';
import { useStore } from '../../store';
import type { SphereId } from '../../constants/theme';

const ICONS = ['◐', '△', '▭', '◇', '○', '◔', '◯', '⌬'];

export default function HabitsScreen() {
  const { state, dispatch } = useStore();
  const habits = state.habits;

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSphere, setNewSphere] = useState<SphereId>('health');
  const [newTarget, setNewTarget] = useState('');
  const [newIcon, setNewIcon] = useState('○');

  const toggle = (id: string) => dispatch({ type: 'TOGGLE_HABIT', id });

  const saveHabit = () => {
    const label = newLabel.trim();
    if (!label) return;
    dispatch({
      type: 'ADD_HABIT',
      habit: {
        id: `h-${Date.now()}`,
        label,
        icon: newIcon,
        sphere: newSphere,
        streak: 0,
        target: newTarget.trim() || '1 session',
        doneToday: false,
      },
    });
    setNewLabel('');
    setNewTarget('');
    setNewIcon('○');
    setAdding(false);
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
      <SectionLabel action="12 weeks">Completion</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={18}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View>
              <Text style={{ fontFamily: F.display, fontSize: 48, color: COLORS.ink1, lineHeight: 52, letterSpacing: -0.8 }}>47</Text>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, letterSpacing: 0.5, marginTop: 4 }}>day streak</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, letterSpacing: 0.5 }}>72-day total</Text>
              <Text style={{ fontFamily: F.display, fontSize: 26, color: COLORS.ink1, lineHeight: 30, marginTop: 6 }}>89%</Text>
            </View>
          </View>
          <Heatmap values={HEATMAP} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>Feb</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>less</Text>
              {[0.06, 0.22, 0.5, 0.88].map((o, i) => (
                <View key={i} style={{ width: 9, height: 9, backgroundColor: COLORS.ink1, opacity: o, borderRadius: 2 }} />
              ))}
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>more</Text>
            </View>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>May</Text>
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
