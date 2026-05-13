import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
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

function formatDueDate(date: Date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export default function GoalsScreen() {
  const { state, dispatch } = useStore();
  const { sphere: sphereParam } = useLocalSearchParams<{ sphere?: string }>();
  const [filter, setFilter] = useState<string>(sphereParam ?? 'all');
  
  // Add/Edit state
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newSphere, setNewSphere] = useState<SphereId>('career');
  const [newDue, setNewDue] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);

  const filtered = filter === 'all' ? state.goals : state.goals.filter(g => g.sphere === filter);

  // Initialize form for adding
  const startAdd = () => {
    setNewTitle('');
    // Use current filter if it's a valid sphere, else default to career
    setNewSphere(filter !== 'all' ? filter as SphereId : 'career');
    setNewDue(new Date());
    setNewSubtask('');
    setSubtasks([]);
    setAdding(true);
    setEditingId(null);
  };

  // Initialize form for editing
  const startEdit = (g: any) => {
    setNewTitle(g.title);
    setNewSphere(g.sphere);
    // Parse due date if possible, else today
    const d = new Date(g.due);
    setNewDue(isNaN(d.getTime()) ? new Date() : d);
    setNewSubtask('');
    setSubtasks(g.sub.map((s: any) => s.t));
    setEditingId(g.id);
    setAdding(false);
  };

  const addSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks([...subtasks, t]);
    setNewSubtask('');
  };

  const removeSubtask = (idx: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== idx));
  };

  const saveGoal = () => {
    const title = newTitle.trim();
    if (!title) return;
    
    const finalSubtasks = [...subtasks];
    if (newSubtask.trim()) finalSubtasks.push(newSubtask.trim());
    const sub = finalSubtasks.map(t => ({ id: crypto.randomUUID(), t, done: false }));

    if (editingId) {
      dispatch({
        type: 'UPDATE_GOAL',
        goalId: editingId,
        patch: {
          sphere: newSphere,
          title,
          due: formatDueDate(newDue),
          sub: finalSubtasks.map((t, i) => {
            // Try to preserve existing subtask ID and 'done' status
            const existing = state.goals.find(g => g.id === editingId)?.sub[i];
            if (existing && existing.t === t) {
              return { id: existing.id, t, done: existing.done };
            }
            return { id: crypto.randomUUID(), t, done: false };
          }),
        },
      });
    } else {
      dispatch({
        type: 'ADD_GOAL',
        goal: {
          id: crypto.randomUUID(),
          sphere: newSphere,
          title,
          due: formatDueDate(newDue),
          progress: 0,
          sub,
        },
      });
    }
    cancelAdd();
  };

  const cancelAdd = () => {
    setNewTitle('');
    setNewDue(new Date());
    setNewSubtask('');
    setSubtasks([]);
    setAdding(false);
    setEditingId(null);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewDue(selectedDate);
    }
  };

  const renderGoalForm = (title: string) => (
    <Card pad={18}>
      <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 12 }}>{title}</Text>

      {/* Sphere picker — only show if in 'all' view or editing */}
      {(filter === 'all' || editingId) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {SPHERE_LIST.map(id => (
            <Pill key={id} active={newSphere === id} onPress={() => setNewSphere(id)}>
              <Text style={{ color: newSphere === id ? COLORS.paper : SPHERE_COLORS[id].deep }}>{SPHERE_COLORS[id].glyph} </Text>
              {SPHERE_COLORS[id].label}
            </Pill>
          ))}
        </View>
      )}

      <TextInput
        autoFocus
        value={newTitle}
        onChangeText={setNewTitle}
        placeholder="Goal title"
        placeholderTextColor={COLORS.ink4}
        style={{ fontFamily: F.displayItalic, fontSize: 18, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}
      />

      <TouchableOpacity
        onPress={() => setShowDatePicker(true)}
        style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}
      >
        <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1 }}>
          Due: <Text style={{ fontWeight: '600' }}>{formatDueDate(newDue)}</Text>
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={newDue}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={onDateChange}
        />
      )}

      {/* Subtasks list */}
      {subtasks.length > 0 && (
        <View style={{ marginBottom: 10, gap: 4 }}>
          {subtasks.map((st, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: COLORS.ink3 }}>•</Text>
              <TextInput
                value={st}
                onChangeText={(text) => {
                  const next = [...subtasks];
                  next[i] = text;
                  setSubtasks(next);
                }}
                style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink2, flex: 1, paddingVertical: 2 }}
              />
              <TouchableOpacity onPress={() => removeSubtask(i)}>
                <Text style={{ fontSize: 18, color: COLORS.ink4 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 16 }}>
        <TextInput
          value={newSubtask}
          onChangeText={setNewSubtask}
          placeholder="Add subtask"
          placeholderTextColor={COLORS.ink4}
          onSubmitEditing={addSubtask}
          returnKeyType="next"
          style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, paddingVertical: 6, flex: 1 }}
        />
        <TouchableOpacity onPress={addSubtask} disabled={!newSubtask.trim()}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: newSubtask.trim() ? COLORS.ink1 : COLORS.ink4 }}>ADD</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {editingId ? (
          <TouchableOpacity onPress={() => {
            Alert.alert(
              'Delete Goal',
              'Are you sure you want to delete this goal and all its subtasks?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Delete', 
                  style: 'destructive',
                  onPress: () => {
                    dispatch({ type: 'REMOVE_GOAL', goalId: editingId });
                    cancelAdd();
                  }
                },
              ]
            );
          }}>
            <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.accentWarm }}>Delete</Text>
          </TouchableOpacity>
        ) : <View />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={cancelAdd} style={{ padding: 8 }}>
            <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={saveGoal}
            disabled={!newTitle.trim()}
            style={{ backgroundColor: COLORS.ink1, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 99, opacity: newTitle.trim() ? 1 : 0.4 }}
          >
            <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.paper, fontWeight: '500' }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

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
      <View style={{ paddingHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 12 }}>
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
      </View>

      {/* Goal cards */}
      <View style={{ paddingHorizontal: 22, gap: 12 }}>
        {filtered.map(g => {
          if (editingId === g.id) return <View key={g.id}>{renderGoalForm('Edit Goal')}</View>;

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
                  <TouchableOpacity onPress={() => startEdit(g)} style={{ marginLeft: 'auto' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink4, letterSpacing: 1 }}>EDIT</Text>
                  </TouchableOpacity>
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
            onPress={startAdd}
            style={{
              borderWidth: 1, borderColor: COLORS.ink5, borderStyle: 'dashed',
              borderRadius: 18, padding: 18,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ fontFamily: undefined, fontSize: 18, color: COLORS.ink3, lineHeight: 20 }}>+</Text>
            <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink3 }}>New goal</Text>
          </TouchableOpacity>
        ) : renderGoalForm('New Goal')}
      </View>
    </ScrollView>
  );
}


