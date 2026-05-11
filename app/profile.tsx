import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../constants/theme';
import { BADGES, levelFromXp } from '../constants/data';
import { Card, SectionLabel, Bar, Pill, F } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/auth';
import { useProfile } from '../store/profile';
import { useStore } from '../store';
import { syncHabitsToCalendar, removeAllHabitsFromCalendar } from '../lib/calendar';
import { getNotificationTimes, saveNotificationTimes, DEFAULT_NOTIFICATION_TIMES } from '../lib/notification-prefs';
import { scheduleMorningNotification, scheduleEveningClose } from '../lib/notifications';

const CALENDAR_SYNC_KEY = '@goalify/calendar_sync';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { profile, update, deleteAccount } = useProfile();
  const { state, dispatch } = useStore();

  const lvl = levelFromXp(0);
  const earned: typeof BADGES = [];
  const [name, setName] = useState(profile?.display_name ?? '');
  const [pronoun, setPronoun] = useState(profile?.pronouns ?? '');
  const [genderAware, setGenderAware] = useState(profile?.gender_aware_coaching ?? true);
  const [calendarSync, setCalendarSync] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [tab, setTab] = useState<'details' | 'badges'>('details');

  const toDate = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
  const [morningTime, setMorningTime] = useState(() => toDate(DEFAULT_NOTIFICATION_TIMES.morningHour, DEFAULT_NOTIFICATION_TIMES.morningMinute));
  const [eveningTime, setEveningTime] = useState(() => toDate(DEFAULT_NOTIFICATION_TIMES.eveningHour, DEFAULT_NOTIFICATION_TIMES.eveningMinute));
  const [showMorningPicker, setShowMorningPicker] = useState(false);
  const [showEveningPicker, setShowEveningPicker] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CALENDAR_SYNC_KEY).then(v => setCalendarSync(v === '1'));
    getNotificationTimes().then(t => {
      setMorningTime(toDate(t.morningHour, t.morningMinute));
      setEveningTime(toDate(t.eveningHour, t.eveningMinute));
    });
  }, []);

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const onMorningChange = (_: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShowMorningPicker(false);
    if (!date) return;
    setMorningTime(date);
    saveNotificationTimes({ morningHour: date.getHours(), morningMinute: date.getMinutes() })
      .then(() => scheduleMorningNotification())
      .catch(() => {});
  };

  const onEveningChange = (_: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShowEveningPicker(false);
    if (!date) return;
    setEveningTime(date);
    saveNotificationTimes({ eveningHour: date.getHours(), eveningMinute: date.getMinutes() })
      .then(() => scheduleEveningClose())
      .catch(() => {});
  };

  const toggleCalendarSync = async () => {
    if (calendarSyncing) return;
    const next = !calendarSync;
    setCalendarSyncing(true);
    try {
      if (next) {
        await syncHabitsToCalendar(state.habits, (habitId, eventId) => {
          dispatch({ type: 'SET_HABIT_CALENDAR_ID', id: habitId, calendarEventId: eventId });
        });
      } else {
        await removeAllHabitsFromCalendar(state.habits);
      }
      setCalendarSync(next);
      await AsyncStorage.setItem(CALENDAR_SYNC_KEY, next ? '1' : '0');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Calendar sync failed', msg);
    } finally {
      setCalendarSyncing(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? '');
    setPronoun(profile.pronouns ?? '');
    setGenderAware(profile.gender_aware_coaching);
  }, [profile]);

  // Last-write-wins: persist on blur of either text field, or toggle change.
  const persist = (patch: Parameters<typeof update>[0]) => {
    update(patch);
  };

  const onSignOut = async () => {
    await signOut();
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account and all data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteAccount();
            if (error) Alert.alert('Failed', error);
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M9 2L3 7l6 5" stroke={COLORS.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>Profile</Text>
      </View>

      {/* Identity card */}
      <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: COLORS.ink1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.displayItalic, fontSize: 36, color: COLORS.paper }}>{name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.display, fontSize: 30, color: COLORS.ink1, letterSpacing: -0.5, lineHeight: 34 }}>{name}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginTop: 6 }}>
              Level {lvl.lvl.n} · {lvl.lvl.name}
            </Text>
            <Bar value={lvl.pct} color={COLORS.ink1} style={{ marginTop: 8 }} />
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, marginTop: 4 }}>
              {lvl.into.toLocaleString()} / {lvl.next.min.toLocaleString()} XP
            </Text>
          </View>
        </View>
      </View>

      {/* Stat row */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22, flexDirection: 'row', gap: 8 }}>
        {[
          { n: 0, l: 'day streak' },
          { n: earned.length, l: 'badges' },
          { n: 12, l: 'goals done' },
        ].map((s, i) => (
          <Card key={i} pad={14} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.display, fontSize: 28, color: COLORS.ink1, lineHeight: 32 }}>{s.n}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, marginTop: 6, textAlign: 'center' }}>{s.l}</Text>
          </Card>
        ))}
      </View>

      {/* Tabs */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22, flexDirection: 'row', gap: 6 }}>
        <Pill active={tab === 'details'} onPress={() => setTab('details')}>Details</Pill>
        <Pill active={tab === 'badges'} onPress={() => setTab('badges')}>Badges · {earned.length}/{BADGES.length}</Pill>
      </View>

      {tab === 'details' && (
        <>
          <SectionLabel>Personal details</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={4}>
              {[
                { label: 'Display name', value: name, onChange: setName, onBlur: () => persist({ display_name: name.trim() || 'You' }) },
                { label: 'Pronouns',     value: pronoun, onChange: setPronoun, onBlur: () => persist({ pronouns: pronoun.trim() || null }) },
              ].map((row, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 14, paddingVertical: 14,
                  borderBottomWidth: i === 0 ? 0.5 : 0, borderBottomColor: COLORS.ink7,
                }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 1.5, textTransform: 'uppercase', width: 88 }}>{row.label}</Text>
                  <TextInput
                    value={row.value} onChangeText={row.onChange} onBlur={row.onBlur}
                    style={{ flex: 1, fontFamily: undefined, fontSize: 14, color: COLORS.ink1, textAlign: 'right' }}
                  />
                </View>
              ))}
            </Card>
          </View>

          <SectionLabel>AI personalization</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>Gender-aware imagery</Text>
                  <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 4, lineHeight: 17 }}>Vision board figures and affirmations adapt to the pronouns above.</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const next = !genderAware;
                    setGenderAware(next);
                    persist({ gender_aware_coaching: next });
                  }}
                  style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: genderAware ? COLORS.ink1 : COLORS.ink6, position: 'relative', flexShrink: 0 }}
                >
                  <View style={{
                    position: 'absolute', top: 3, left: genderAware ? 21 : 3,
                    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                  }} />
                </TouchableOpacity>
              </View>
            </Card>
          </View>

          <SectionLabel>Reminders</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={4}>
              {/* Morning */}
              <TouchableOpacity
                onPress={() => setShowMorningPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink7 }}
              >
                <View>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>Morning ritual</Text>
                  <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>Pick today's One</Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: COLORS.ink2 }}>{fmt(morningTime)}</Text>
              </TouchableOpacity>
              {showMorningPicker && (
                <DateTimePicker
                  value={morningTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onMorningChange}
                />
              )}

              {/* Evening */}
              <TouchableOpacity
                onPress={() => setShowEveningPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 }}
              >
                <View>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>Evening close</Text>
                  <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>Close the day</Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: COLORS.ink2 }}>{fmt(eveningTime)}</Text>
              </TouchableOpacity>
              {showEveningPicker && (
                <DateTimePicker
                  value={eveningTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEveningChange}
                />
              )}
            </Card>
          </View>

          <SectionLabel>App</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={4}>
              <TouchableOpacity
                onPress={() => router.push('/tour')}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.ink7 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>How Goalify works</Text>
                  <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 3 }}>A quick tour of every feature</Text>
                </View>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>→</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '500' }}>
                    {calendarSyncing ? 'Syncing…' : 'Sync habits to Calendar'}
                  </Text>
                  <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 4, lineHeight: 17 }}>
                    Adds each habit as a daily recurring event in your device calendar.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={toggleCalendarSync}
                  disabled={calendarSyncing}
                  style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: calendarSync ? COLORS.ink1 : COLORS.ink6, position: 'relative', flexShrink: 0, opacity: calendarSyncing ? 0.5 : 1 }}
                >
                  <View style={{
                    position: 'absolute', top: 3, left: calendarSync ? 21 : 3,
                    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                  }} />
                </TouchableOpacity>
              </View>
            </Card>
          </View>

          <SectionLabel>Account</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={4}>
              {([
                { k: 'Email', v: user?.email ?? '—' },
                { k: 'Joined', v: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
                { k: 'Sign out', v: '→', onPress: onSignOut },
                { k: 'Delete account', v: '→', danger: true, onPress: onDelete },
              ] as Array<{ k: string; v: string; onPress?: () => void; danger?: boolean }>).map((row, i, arr) => {
                const inner = (
                  <>
                    <Text style={{ fontFamily: undefined, fontSize: 14, color: row.danger ? '#A33' : COLORS.ink1 }}>{row.k}</Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>{row.v}</Text>
                  </>
                );
                const style = {
                  flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
                  paddingHorizontal: 14, paddingVertical: 14,
                  borderBottomWidth: i < arr.length - 1 ? 0.5 : 0, borderBottomColor: COLORS.ink7,
                };
                return row.onPress ? (
                  <TouchableOpacity key={i} onPress={row.onPress} style={style}>{inner}</TouchableOpacity>
                ) : (
                  <View key={i} style={style}>{inner}</View>
                );
              })}
            </Card>
          </View>
        </>
      )}

      {tab === 'badges' && (
        <>
          <SectionLabel action={`${earned.length}/${BADGES.length}`}>Earned</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={4}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {BADGES.map((b, i) => {
                  const isEarned = earned.some(e => e.id === b.id);
                  return (
                  <View key={b.id} style={{
                    width: '25%', aspectRatio: 1,
                    alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8,
                    borderRightWidth: (i + 1) % 4 ? 0.5 : 0, borderRightColor: COLORS.ink7,
                    borderBottomWidth: i < BADGES.length - 4 ? 0.5 : 0, borderBottomColor: COLORS.ink7,
                    opacity: isEarned ? 1 : 0.45,
                  }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: isEarned ? COLORS.ink1 : 'transparent',
                      borderWidth: isEarned ? 0 : 1, borderColor: COLORS.ink5, borderStyle: 'dashed',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: isEarned ? COLORS.paper : COLORS.ink4, fontSize: 15 }}>{b.g}</Text>
                    </View>
                    <Text style={{
                      fontFamily: F.mono, fontSize: 7, letterSpacing: 0.5,
                      color: COLORS.ink2, textAlign: 'center', lineHeight: 10,
                      textTransform: 'uppercase',
                    }}>{b.name}</Text>
                  </View>
                  );
                })}
              </View>
            </Card>
          </View>

          <SectionLabel>Most recent</SectionLabel>
          <View style={{ paddingHorizontal: 22, gap: 8 }}>
            {earned.slice(-3).reverse().map(b => (
              <Card key={b.id} pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.ink1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 16, color: COLORS.paper }}>{b.g}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: '600' }}>{b.name}</Text>
                  <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 2 }}>{b.desc}</Text>
                </View>
              </Card>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
