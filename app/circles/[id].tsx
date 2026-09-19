import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Share, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { Card, SectionLabel, F } from '../../components/ui';
import { useCircles } from '../../store/circles';
import { useAuth } from '../../store/auth';

export default function CircleDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { circles, membersFor, loadMembers } = useCircles();
  const { user } = useAuth();

  const circle = useMemo(() => circles.find(c => c.id === id), [circles, id]);
  const members = membersFor(id ?? '');

  useEffect(() => {
    if (id) loadMembers(id);
  }, [id, loadMembers]);

  const onShareCode = () => {
    if (!circle) return;
    const message = `Join my Goalify circle "${circle.name}" — use invite code ${circle.invite_code}`;
    if (Platform.OS === 'web') {
      Share.share({ title: 'Circle invite', message }).catch(() => {});
    } else {
      Share.share({ message }).catch(() => {});
    }
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
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>Circle</Text>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 6 }}>
        <Text style={{ fontFamily: F.display, fontSize: 30, color: COLORS.ink1, letterSpacing: -0.5, lineHeight: 34 }}>
          {circle?.name ?? '…'}
        </Text>
        {circle && (
          <TouchableOpacity onPress={onShareCode} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: COLORS.ink3 }}>
              INVITE CODE {circle.invite_code}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, textDecorationLine: 'underline' }}>share</Text>
          </TouchableOpacity>
        )}
      </View>

      <SectionLabel>Today</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 8 }}>
        {members.length === 0 && (
          <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>No members yet.</Text>
        )}
        {members.map(m => (
          <Card key={m.user_id} pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: m.must_do_done ? '#3A7D44' : COLORS.ink6,
              }}
            />
            <Text style={{ flex: 1, fontFamily: undefined, fontSize: 14, color: COLORS.ink1, fontWeight: m.user_id === user?.id ? '600' : '400' }}>
              {m.display_name}{m.user_id === user?.id ? ' (you)' : ''}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>
              {m.streak > 0 ? `${m.streak}d streak` : '—'}
            </Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
