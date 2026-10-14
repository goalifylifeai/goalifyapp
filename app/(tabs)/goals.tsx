import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '../../components/DateTimePicker';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST, SPHERE_VISION_CAPTIONS, SPHERE_VISION_TONES } from '../../constants/data';
import { SectionLabel, Card, SphereChip, Bar, Check, Pill, F } from '../../components/ui';
import { VisionBanner } from '../../components/vision/VisionBanner';
import { HabitPromptModal } from '../../components/HabitPromptModal';
import { useStore } from '../../store';
import type { Goal } from '../../store';
import type { SphereId } from '../../constants/theme';
import { newId } from '../../lib/id';
import { localDateISO, formatDisplayDate, addDaysISO } from '../../lib/date';
import { effectiveDue, goalHealth, goalStatus, healthParts, sortByUrgency, type GoalStatus } from '../../lib/goal-health';
import { activeGoals, completedGoals } from '../../lib/goals';

export default function GoalsScreen() {
  const { state, dispatch } = useStore();
  const { sphere: sphereParam, add: addParam, n: nonceParam } =
    useLocalSearchParams<{ sphere?: string; add?: string; n?: string }>();
  const [filter, setFilter] = useState<string>(sphereParam ?? 'all');
  const [query, setQuery] = useState('');
  
  // Add/Edit state
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newSphere, setNewSphere] = useState<SphereId>('career');
  // Optional due date (spec 011 FR-004): null = "No date". `dueTouched` keeps
  // an edit from rewriting a date the user never changed (e.g. a legacy
  // creation-day date that is hidden but still stored).
  const [newDue, setNewDue] = useState<Date | null>(null);
  const [dueTouched, setDueTouched] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [habitPromptGoal, setHabitPromptGoal] = useState<Goal | null>(null);

  const [showCompleted, setShowCompleted] = useState(false);

  const active = activeGoals(state.goals);
  const completed = completedGoals(state.goals);
  const matches = (g: Goal) => {
    if (filter !== 'all' && g.sphere !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return g.title.toLowerCase().includes(q) || g.sub.some(s => s.t.toLowerCase().includes(q));
  };
  const today = localDateISO();
  const healthOf = (g: Goal) => goalHealth(g, state.habits, today);
  const statusOf = (g: Goal): GoalStatus => goalStatus(g, healthOf(g), today);
  const filtered = sortByUrgency(active.filter(matches), statusOf);
  const filteredCompleted = completed.filter(matches);

  const markComplete = (g: Goal) =>
    dispatch({ type: 'UPDATE_GOAL', goalId: g.id, patch: { completedAt: new Date().toISOString() } });
  const reopen = (g: Goal) =>
    dispatch({ type: 'UPDATE_GOAL', goalId: g.id, patch: { completedAt: undefined } });

  // Initialize form for adding
  const startAdd = (sphere?: SphereId) => {
    setNewTitle('');
    // Use the given sphere, else the current filter if it's a sphere, else career
    setNewSphere(sphere ?? (filter !== 'all' ? filter as SphereId : 'career'));
    setNewDue(null);
    setDueTouched(false);
    setNewSubtask('');
    setSubtasks([]);
    setAdding(true);
    setEditingId(null);
  };

  // Tabs stay mounted, so a later push with ?sphere= must re-sync the filter
  // (home "Sphere balance" cards and the empty-sphere nudge both route here).
  // ?add=1 (from the nudge) also opens the form pre-set to that sphere; the
  // nonce lets the same nudge be tapped twice in a row.
  useEffect(() => {
    if (!sphereParam) return;
    setFilter(sphereParam);
    if (addParam === '1' && SPHERE_LIST.includes(sphereParam as SphereId)) {
      startAdd(sphereParam as SphereId);
    }
  }, [sphereParam, addParam, nonceParam]);

  // Initialize form for editing
  const startEdit = (g: any) => {
    setNewTitle(g.title);
    setNewSphere(g.sphere);
    const due = effectiveDue(g);
    setNewDue(due ? new Date(`${due}T00:00:00`) : null);
    setDueTouched(false);
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
    const sub = finalSubtasks.map(t => ({ id: newId(), t, done: false }));

    if (editingId) {
      dispatch({
        type: 'UPDATE_GOAL',
        goalId: editingId,
        patch: {
          sphere: newSphere,
          title,
          ...(dueTouched ? { due: newDue ? localDateISO(newDue) : '' } : {}),
          sub: finalSubtasks.map((t, i) => {
            // Try to preserve existing subtask ID and 'done' status
            const existing = state.goals.find(g => g.id === editingId)?.sub[i];
            if (existing && existing.t === t) {
              return { id: existing.id, t, done: existing.done };
            }
            return { id: newId(), t, done: false };
          }),
        },
      });
    } else {
      const goal: Goal = {
        id: newId(),
        sphere: newSphere,
        title,
        due: newDue ? localDateISO(newDue) : '',
        progress: 0,
        sub,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_GOAL', goal });
      setHabitPromptGoal(goal);
    }
    cancelAdd();
  };

  const saveHabitForGoal = (label: string) => {
    if (!habitPromptGoal) return;
    dispatch({
      type: 'ADD_HABIT',
      habit: {
        id: newId(),
        label,
        icon: '○',
        sphere: habitPromptGoal.sphere,
        streak: 0,
        target: '1 session',
        doneToday: false,
        goalId: habitPromptGoal.id,
      },
    });
    setHabitPromptGoal(null);
  };

  const cancelAdd = () => {
    setNewTitle('');
    setNewDue(null);
    setDueTouched(false);
    setNewSubtask('');
    setSubtasks([]);
    setAdding(false);
    setEditingId(null);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    // Only Android's modal dialog closes on pick. On web, Chrome fires a change on
    // month-arrow clicks, so hiding here would close the calendar mid-browse.
    setShowDatePicker(Platform.OS !== 'android');
    if (selectedDate) {
      setNewDue(selectedDate);
      setDueTouched(true);
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
        testID="goal-title-input"
        autoFocus
        value={newTitle}
        onChangeText={setNewTitle}
        placeholder="Goal title"
        placeholderTextColor={COLORS.ink4}
        style={{ fontFamily: F.displayItalic, fontSize: 18, color: COLORS.ink1, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink6, marginBottom: 12 }}>
        <TouchableOpacity testID="goal-due-set" onPress={() => setShowDatePicker(true)} style={{ flex: 1 }}>
          <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1 }}>
            {newDue
              ? <>Due: <Text style={{ fontWeight: '600' }}>{formatDisplayDate(localDateISO(newDue))}</Text></>
              : <Text style={{ color: COLORS.ink3 }}>No due date · <Text style={{ color: COLORS.ink1, fontWeight: '600' }}>Set one</Text></Text>}
          </Text>
        </TouchableOpacity>
        {newDue && (
          <TouchableOpacity testID="goal-due-clear" onPress={() => { setNewDue(null); setDueTouched(true); setShowDatePicker(false); }} hitSlop={8}>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: COLORS.ink4 }}>CLEAR</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={newDue ?? tomorrow()}
          mode="date"
          // Earliest is tomorrow: a goal due the day it's made is a task, and
          // a same-day due date reads as the legacy default (lib/goal-health).
          minimumDate={tomorrow()}
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
            testID="save-goal-button"
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
    <>
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          {active.length} active · {completed.length} completed
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8, marginBottom: 0 }}>
          Goals.
        </Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 22, paddingTop: 4 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.ink7,
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
        }}>
          <Text style={{ fontSize: 13, color: COLORS.ink4 }}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search goals…"
            placeholderTextColor={COLORS.ink4}
            style={{ flex: 1, fontFamily: undefined, fontSize: 13.5, color: COLORS.ink1 }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={{ fontSize: 13, color: COLORS.ink4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ paddingVertical: 12 }}
        contentContainerStyle={{ paddingHorizontal: 22, flexDirection: 'row', gap: 6 }}
      >
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
          if (editingId === g.id) return <View key={g.id}>{renderGoalForm('Edit Goal')}</View>;

          const s = SPHERE_COLORS[g.sphere];
          const done = g.sub.filter(x => x.done).length;
          const health = healthOf(g);
          const status = statusOf(g);
          const due = effectiveDue(g);
          const parts = healthParts(g, state.habits, today);
          const tone = SPHERE_VISION_TONES[g.sphere];
          const caption = SPHERE_VISION_CAPTIONS[g.sphere];

          return (
            <Card key={g.id} pad={0} style={{ overflow: 'hidden' }}>
              <VisionBanner
                goalId={g.id}
                goalTitle={g.title}
                sphere={g.sphere}
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
                  {due && (
                    <>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4 }}>·</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>Due {formatDisplayDate(due)}</Text>
                    </>
                  )}
                  <TouchableOpacity testID={`complete-goal-${g.id}`} onPress={() => markComplete(g)} style={{ marginLeft: 'auto' }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: s.deep, letterSpacing: 1 }}>✓ COMPLETE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => startEdit(g)}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink4, letterSpacing: 1 }}>EDIT</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontFamily: F.display, fontSize: 22, lineHeight: 26, color: COLORS.ink1, letterSpacing: -0.2 }}>{g.title}</Text>
                <StatusLine goalId={g.id} status={status} />
                {status.kind === 'overdue' && (
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <TouchableOpacity
                      testID={`goal-move-due-${g.id}`}
                      onPress={() => dispatch({ type: 'UPDATE_GOAL', goalId: g.id, patch: { due: addDaysISO(today, 7) } })}
                    >
                      <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: COLORS.ink2 }}>MOVE TO NEXT WEEK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`goal-clear-due-${g.id}`}
                      onPress={() => dispatch({ type: 'UPDATE_GOAL', goalId: g.id, patch: { due: '' } })}
                    >
                      <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: COLORS.ink4 }}>CLEAR DATE</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {health === null ? (
                  <Text testID={`goal-no-plan-${g.id}`} style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 14, lineHeight: 17 }}>
                    No plan yet. Add a subtask or a habit and this starts to move.
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <Bar value={health} color={s.accent} style={{ flex: 1 }} />
                    <Text testID={`goal-health-${g.id}`} style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2 }}>{Math.round(health * 100)}%</Text>
                  </View>
                )}
                {parts.habits !== null && (
                  <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1, color: COLORS.ink3, marginTop: 6 }}>
                    {parts.habitCount === 1 ? 'HABIT' : `${parts.habitCount} HABITS`} · {Math.round(parts.habits * 7)}/7 DAYS THIS WEEK
                  </Text>
                )}
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
            testID="new-goal-button"
            onPress={() => startAdd()}
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

      {/* Completed goals */}
      {filteredCompleted.length > 0 && (
        <View style={{ paddingHorizontal: 22, paddingTop: 28 }}>
          <SectionLabel
            action={showCompleted ? 'Hide' : 'Show'}
            onAction={() => setShowCompleted(v => !v)}
          >
            {`Completed · ${filteredCompleted.length}`}
          </SectionLabel>
          {showCompleted && (
            <View style={{ gap: 8 }}>
              {filteredCompleted.map(g => {
                const s = SPHERE_COLORS[g.sphere];
                return (
                  <Card key={g.id} pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <SphereChip sphere={g.sphere} size={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: F.display, fontSize: 17, lineHeight: 21, color: COLORS.ink1 }}>{g.title}</Text>
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, marginTop: 3 }}>
                        {s.label} · Completed {formatDisplayDate(localDateISO(new Date(g.completedAt!)))}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => reopen(g)}>
                      <Text style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink4, letterSpacing: 1 }}>REOPEN</Text>
                    </TouchableOpacity>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
    <HabitPromptModal
      visible={!!habitPromptGoal}
      goalTitle={habitPromptGoal?.title ?? ''}
      onSave={saveHabitForGoal}
      onSkip={() => setHabitPromptGoal(null)}
    />
    </>
  );
}



function tomorrow(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

function StatusLine({ goalId, status }: { goalId: string; status: GoalStatus }) {
  if (status.kind !== 'overdue' && status.kind !== 'at_risk') return null;
  const text = status.kind === 'overdue'
    ? `Overdue · ${status.days} ${status.days === 1 ? 'day' : 'days'}`
    : `At risk · ${status.daysLeft === 0 ? 'due today' : status.daysLeft === 1 ? 'due tomorrow' : `due in ${status.daysLeft} days`}`;
  return (
    <Text
      testID={`goal-status-${goalId}`}
      style={{
        alignSelf: 'flex-start', marginTop: 10,
        fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
        color: status.kind === 'overdue' ? COLORS.accentWarm : COLORS.ink2,
      }}
    >
      {text}
    </Text>
  );
}
