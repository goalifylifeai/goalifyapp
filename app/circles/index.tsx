import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Card, SectionLabel, F } from '../../components/ui';
import { useCircles } from '../../store/circles';
import { track } from '../../lib/analytics';

export default function CirclesScreen() {
  const insets = useSafeAreaInsets();
  const { circles, loading, createCircle, joinCircle } = useCircles();

  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode('none');
    setName('');
    setCode('');
    setError(null);
  };

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    const res = await createCircle(name);
    track('circle_created', { outcome: res.error ? 'error' : 'ok' });
    setBusy(false);
    if (res.error) setError(res.error);
    else reset();
  };

  const onJoin = async () => {
    setBusy(true);
    setError(null);
    const res = await joinCircle(code);
    track('circle_joined', {
      outcome: !res.error ? 'ok'
        : /already a member/i.test(res.error) ? 'already_member'
        : /invite code/i.test(res.error) ? 'invalid_code'
        : 'error',
    });
    setBusy(false);
    if (res.error) setError(res.error);
    else reset();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
            <Path d="M9 2L3 7l6 5" stroke={COLORS.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>Circles</Text>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 6 }}>
        <Text style={{ fontFamily: F.display, fontSize: 30, color: COLORS.ink1, letterSpacing: -0.5, lineHeight: 34 }}>
          Light-touch accountability
        </Text>
        <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3, marginTop: 6, lineHeight: 19 }}>
          Circles only show whether someone finished today&apos;s must-do and their
          streak — never your goals, habits, or journal.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 18, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={() => setMode(mode === 'create' ? 'none' : 'create')}
          style={{ flex: 1, backgroundColor: mode === 'create' ? COLORS.ink1 : COLORS.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: mode === 'create' ? COLORS.paper : COLORS.ink1 }}>
            + New circle
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode(mode === 'join' ? 'none' : 'join')}
          style={{ flex: 1, backgroundColor: mode === 'join' ? COLORS.ink1 : COLORS.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: mode === 'join' ? COLORS.paper : COLORS.ink1 }}>
            Join with code
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'create' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
          <Card pad={16}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 8 }}>
              Circle name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Morning Runners"
              placeholderTextColor={COLORS.ink5}
              style={{ fontSize: 15, color: COLORS.ink1, paddingVertical: 8 }}
              autoFocus
              maxLength={50}
            />
            {error && <Text style={{ color: '#A33', fontSize: 12, marginTop: 6 }}>{error}</Text>}
            <TouchableOpacity
              onPress={onCreate}
              disabled={busy || !name.trim()}
              style={{ marginTop: 12, backgroundColor: COLORS.ink1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: busy || !name.trim() ? 0.5 : 1 }}
            >
              {busy ? <ActivityIndicator color={COLORS.paper} /> : (
                <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.paper }}>Create</Text>
              )}
            </TouchableOpacity>
          </Card>
        </View>
      )}

      {mode === 'join' && (
        <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
          <Card pad={16}>
            <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 8 }}>
              Invite code
            </Text>
            <TextInput
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              placeholder="e.g. K3XQPT"
              placeholderTextColor={COLORS.ink5}
              style={{ fontSize: 15, color: COLORS.ink1, paddingVertical: 8, letterSpacing: 2 }}
              autoFocus
              autoCapitalize="characters"
              maxLength={6}
            />
            {error && <Text style={{ color: '#A33', fontSize: 12, marginTop: 6 }}>{error}</Text>}
            <TouchableOpacity
              onPress={onJoin}
              disabled={busy || !code.trim()}
              style={{ marginTop: 12, backgroundColor: COLORS.ink1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: busy || !code.trim() ? 0.5 : 1 }}
            >
              {busy ? <ActivityIndicator color={COLORS.paper} /> : (
                <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.paper }}>Join</Text>
              )}
            </TouchableOpacity>
          </Card>
        </View>
      )}

      <SectionLabel>Your circles</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        {loading && circles.length === 0 && <ActivityIndicator color={COLORS.ink3} />}
        {!loading && circles.length === 0 && (
          <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>
            No circles yet. Create one or join with a code from a friend.
          </Text>
        )}
        {circles.map(circle => (
          <TouchableOpacity key={circle.id} onPress={() => router.push(`/circles/${circle.id}` as any)}>
            <Card pad={16} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: undefined, fontSize: 15, fontWeight: '500', color: COLORS.ink1 }}>{circle.name}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: COLORS.ink3, marginTop: 4 }}>
                  CODE {circle.invite_code}
                </Text>
              </View>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>→</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
