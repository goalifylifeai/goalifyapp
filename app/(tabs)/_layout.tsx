import { Tabs, router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { COLORS } from '../../constants/theme';
import { F } from '../../components/ui';
import { levelFromXp } from '../../constants/data';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../store/profile';

function TabIcon({ focused, icon }: { focused: boolean; icon: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 30, height: 30 }}>
      {focused && (
        <View style={{ position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.ink1, opacity: 0.06 }} />
      )}
      {icon}
    </View>
  );
}

const iconColor = (focused: boolean) => focused ? COLORS.ink1 : COLORS.ink3;

function HeaderRight() {
  const { profile } = useProfile();
  const lvl = levelFromXp(0);
  const initial = profile?.display_name?.[0]?.toUpperCase() ?? '?';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 16 }}>
      <TouchableOpacity
        onPress={() => router.push('/tour')}
        style={{
          width: 30, height: 30, borderRadius: 15,
          backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.ink6,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>?</Text>
      </TouchableOpacity>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingLeft: 5, paddingRight: 10, paddingVertical: 5,
        borderRadius: 99, backgroundColor: COLORS.surface,
        borderWidth: 1, borderColor: COLORS.ink7,
      }}>
        <View style={{
          width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.ink1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: F.mono, fontSize: 11, fontWeight: '600', color: COLORS.paper }}>{lvl.lvl.n}</Text>
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink2, letterSpacing: 0.3 }}>
          0 XP
        </Text>
      </View>
      <TouchableOpacity onPress={() => router.push('/profile')} style={{
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: COLORS.ink7,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 15, color: COLORS.ink1 }}>{initial}</Text>
      </TouchableOpacity>
    </View>
  );
}

function HeaderTitle() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.ink1,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 13, color: COLORS.paper }}>g</Text>
      </View>
      <Text style={{ fontFamily: F.displayItalic, fontSize: 22, color: COLORS.ink1, letterSpacing: -0.4 }}>goalify</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          position: 'absolute',
        },
        tabBarBackground: () => (
          <View style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(244,239,230,0.85)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 0.5,
            borderTopColor: COLORS.ink6,
          }} />
        ),
        tabBarActiveTintColor: COLORS.ink1,
        tabBarInactiveTintColor: COLORS.ink3,
        tabBarLabelStyle: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '600' },
        header: () => (
          <View style={{
            paddingTop: insets.top,
            paddingHorizontal: 22,
            paddingBottom: 12,
            backgroundColor: COLORS.paper,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <HeaderTitle />
            <HeaderRight />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={
              <Svg viewBox="0 0 22 22" width={20} height={20} fill="none" stroke={iconColor(focused)} strokeWidth={1.6} strokeLinecap="round">
                <Circle cx={11} cy={11} r={7.5} />
                <Path d="M11 7v4l2.5 1.5" />
              </Svg>
            } />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={
              <Svg viewBox="0 0 22 22" width={20} height={20} fill="none" stroke={iconColor(focused)} strokeWidth={1.6} strokeLinecap="round">
                <Circle cx={11} cy={11} r={8} />
                <Circle cx={11} cy={11} r={4.5} />
                <Circle cx={11} cy={11} r={1.3} fill={iconColor(focused)} />
              </Svg>
            } />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={
              <Svg viewBox="0 0 22 22" width={20} height={20} fill="none" stroke={iconColor(focused)} strokeWidth={1.6} strokeLinecap="round">
                <Rect x={3} y={3} width={6} height={6} rx={1.5} />
                <Rect x={13} y={3} width={6} height={6} rx={1.5} />
                <Rect x={3} y={13} width={6} height={6} rx={1.5} />
                <Rect x={13} y={13} width={6} height={6} rx={1.5} fill={iconColor(focused)} />
              </Svg>
            } />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={
              <Svg viewBox="0 0 22 22" width={20} height={20} fill="none" stroke={iconColor(focused)} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M5 4h12v14H5z" />
                <Path d="M5 4v14M9 8h5M9 12h5" />
              </Svg>
            } />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={
              <Svg viewBox="0 0 22 22" width={20} height={20} fill="none" stroke={iconColor(focused)} strokeWidth={1.6} strokeLinecap="round">
                <Path d="M3 11l4 4 12-12" />
                <Path d="M3 17l4 4 12-12" opacity={0.45} />
              </Svg>
            } />
          ),
        }}
      />
    </Tabs>
  );
}
