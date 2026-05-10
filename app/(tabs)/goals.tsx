import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST, VISION_CAPTIONS } from '../../constants/data';
import { SectionLabel, Card, SphereChip, Bar, Check, Pill, F } from '../../components/ui';
import { VisionBanner } from '../../components/vision/VisionBanner';
import { useStore } from '../../store';
import type { SphereId } from '../../constants/theme';

const VISION_TONES: Record<string, [string, string]> = {
  g1: ['#E8D5C5', '#C4A593'],
  g2: ['#E8E2D5', '#C9C0AE'],
  g3: ['#D8DEE0', '#A0AAAE'],
  g4: ['#E8D8DC', '#BB9BA0'],
};

const DEFAULT_TONE: [string, string] = ['#E8E2D5', '#C9C0AE'];

export default function GoalsScreen() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<string>('all');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSphere, setNewSphere] = useState<SphereId>('career');
  const [newDue, setNewDue] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  const filtered = filter === 'all' ? state.goals : state.goals.filter(g => g.sphere === filter);

  const saveGoal = () => {
    const title = newTitle.trim();
    if (!title) return;
    const sub = newSubtask.trim() ? [{ t: newSubtask.trim(), done: false }] : [];
    dispatch({
      type: 'ADD_GOAL',
      goal: {
        id: `g-${Date.now()}`,
        sphere: newSphere,
        title,
        due: newDue.trim() || 'TBD',
        progress: 0,
        sub,
      },
    });
    setNewTitle('');
    setNewDue('');
    setNewSubtask('');
    setAdding(false);
  };

  const cancelAdd = () => {
    setNewTitle('');
    setNewDue('');
    setNewSubtask('');
    setAdding(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          {state.goals.length} active · 12 completed
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8, marginBottom: 0 }}>
          Goals.
        </Text>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 6, paddingVertical: 12 }}>
        <Pill active={filter === 'all'} onPress={() => setFilter('all')}>All</Pill>
        {SPHERE_LIST.map(id => {
          const s = SPHERE_COLORS[id];
          return (
            <Pill key={id} active={filter === id} onPress={() => setFilter(id)}>
              <Text style={{ color: filter === id ? COLORS.paper : s.deep }}>{s.glyph} </Text>
              {s.label}
            </Pill>
          );
        })}
      </ScrollView>

      {/* Goal cards */}
      <View style={{ paddingHorizontal: 22, gap: 12 }}>
        {filtered.map(g => {
          const s = SPHERE_COLORS[g.sphere];
          const done = g.sub.filter(x => x.done).length;
          const tone = VISION_TONES[g.id] ?? DEFAULT_TONE;
          const caption = VISION_CAPTIONS[g.id] ?? '';

          return (
            <Card key={g.id} pad={0} style={{ overflow: 'hidden' }}>
              <VisionBanner
                goalId={g.id}
                goalTitle={g.title}
                sphere={g.sphere}
                progress={g.progress}
                caption={caption}
                fallbackColors={tone}
                onPress={() => router.push(`/vision/${g.id}` as any)}
              />

              {/* Content */}
              <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, position: 'relative' }}>
                <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: s.accent }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <SphereChip sphere={g.sphere} size={22} />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 }}>{s.label}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4 }}>·</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>Due {g.due}</Text>
                </View>
                <Text style={{ fontFamily: F.display, fontSize: 22, lineHeight: 26, color: COLORS.ink1, letterSpacing: -0.2 }}>{g.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <Bar value={g.progress} color={s.accent} style={{ flex: 1 }} />
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2 }}>{Math.round(g.progress * 100)}%</Text>
                </View>
              </View>

              {/* Subtasks */}
              {g.sub.length > 0 && (
                <View style={{ paddingHorizontal: 18, paddingBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.soft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: s.deep, fontSize: 7 }}>✦</Text>
                    </View>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 }}>
                      SUBTASKS · {done}/{g.sub.length}
                    </Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    {g.sub.map((st, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => dispatch({ type: 'TOGGLE_SUBTASK', goalId: g.id, idx: i })}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}
                        activeOpacity={0.7}
                      >
                        <Check
                          done={st.done}
                          sphere={g.sphere}
                          size={18}
                          onPress={() => dispatch({ type: 'TOGGLE_SUBTASK', goalId: g.id, idx: i })}
                        />
                        <Text style={{
                          fontFamily: undefined, fontSize: 13, color: COLORS.ink2, flex: 1,
                          textDecorationLine: st.done ? 'line-through' : 'none',
                          opacity: st.done ? 0.55 : 1, letterSpacing: -0.1,
                        }}>{st.t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </Card>
          );
        })}

        {/* Add goal — inline form or trigger */}
        {!adding ? (
          <TouchableOpacity
            onPress={() => setAdding(true)}
            style={{
              borderWidth: 1, borderColor: COLORS.ink5, borderStyle: 'dashed',
              borderRadius: 18, padding: 18,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ fontFamily: undefined, fontSize: 18, color: COLORS.ink3, lineHeight: 20 }}>+</Text>
            <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink3 }}>New goal</Text>
          </TouchableOpacity>
        ) : (
          <Card pad={18}>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>New goal</Text>

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
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Goal title"
              placeholderTextColor={COLORS.ink4}
              style={{ fontFamily: F.displayItalic, fontSize: 18, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}
            />

            <TextInput
              value={newDue}
              onChangeText={setNewDue}
              placeholder="Due date (e.g. Sep 30)"
              placeholderTextColor={COLORS.ink4}
              style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}
            />

            <TextInput
              value={newSubtask}
              onChangeText={setNewSubtask}
              placeholder="First subtask (optional)"
              placeholderTextColor={COLORS.ink4}
              style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 16 }}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity onPress={cancelAdd} style={{ padding: 8 }}>
                <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveGoal}
                style={{ backgroundColor: COLORS.ink1, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 99 }}
              >
                <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.paper, fontWeight: '500' }}>Save goal</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
