import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ViewStyle, TextStyle, Pressable,
} from 'react-native';
import Svg, { Circle, Path, Line, Rect } from 'react-native-svg';
import { COLORS, SPHERE_COLORS, type SphereId } from '../../constants/theme';

// ─── Typography helpers ──────────────────────────────────────────
export const F = {
  display: 'InstrumentSerif_400Regular' as const,
  displayItalic: 'InstrumentSerif_400Regular_Italic' as const,
  mono: 'JetBrainsMono_400Regular' as const,
  monoMedium: 'JetBrainsMono_500Medium' as const,
};

// ─── Section label ───────────────────────────────────────────────
interface SectionLabelProps {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}
export function SectionLabel({ children, action, onAction }: SectionLabelProps) {
  return (
    <View style={sl.row}>
      <Text style={sl.label}>{children}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={sl.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sl = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 10 },
  label:  { fontFamily: F.mono, fontSize: 11, fontWeight: '500', letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 },
  action: { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, textDecorationLine: 'underline' },
});

// ─── Card ────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  pad?: number;
}
export function Card({ children, style, pad = 18 }: CardProps) {
  return (
    <View style={[{ backgroundColor: COLORS.surface, borderRadius: 18, padding: pad }, style]}>
      {children}
    </View>
  );
}

// ─── Sphere chip ─────────────────────────────────────────────────
interface SphereChipProps {
  sphere: SphereId;
  size?: number;
  style?: ViewStyle;
}
export function SphereChip({ sphere, size = 22, style }: SphereChipProps) {
  const s = SPHERE_COLORS[sphere];
  return (
    <View style={[{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: s.soft,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }, style]}>
      <Text style={{ color: s.deep, fontSize: size * 0.5, fontWeight: '600' }}>{s.glyph}</Text>
    </View>
  );
}

// ─── Progress ring ───────────────────────────────────────────────
interface RingProps {
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}
export function Ring({ value = 0.6, size = 48, stroke = 4, color = COLORS.ink1, track = COLORS.ink6, children }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(Math.max(value, 0), 1));
  return (
    <View style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={offset} strokeLinecap="round" />
      </Svg>
      {children !== undefined && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Linear bar ──────────────────────────────────────────────────
interface BarProps {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  style?: ViewStyle;
}
export function Bar({ value, color = COLORS.ink1, track = COLORS.ink6, height = 4, style }: BarProps) {
  return (
    <View style={[{ backgroundColor: track, height, borderRadius: height, overflow: 'hidden' }, style]}>
      <View style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

// ─── Sparkline (SVG) ─────────────────────────────────────────────
interface SparkProps {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}
export function Spark({ data, color, w = 140, h = 32 }: SparkProps) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${path} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={areaPath} fill={color} fillOpacity={0.13} />
      <Path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </Svg>
  );
}

// ─── Sentiment chart ─────────────────────────────────────────────
interface SentimentChartProps {
  data: number[];
  w?: number;
  h?: number;
}
export function SentimentChart({ data, w = 300, h = 108 }: SentimentChartProps) {
  const mid = h / 2;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = mid - (v / 1) * (mid - 8);
    return [x, y, v] as [number, number, number];
  });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Line x1={0} x2={w} y1={mid} y2={mid} stroke={COLORS.ink5} strokeWidth={0.7} strokeDasharray="2 3" />
      <Path d={path} fill="none" stroke={COLORS.ink1} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y, v], i) => (
        <Circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3 : 1.6}
          fill={v >= 0 ? SPHERE_COLORS.finance.accent : SPHERE_COLORS.health.accent} />
      ))}
    </Svg>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────
interface HeatmapProps {
  values: number[];
}
export function Heatmap({ values }: HeatmapProps) {
  const opacities = [0.06, 0.22, 0.5, 0.88];
  const cells = [];
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 7; row++) {
      cells.push({ row, col, v: values[col * 7 + row] ?? 0 });
    }
  }
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: 12 }, (_, col) => (
        <View key={col} style={{ flex: 1, gap: 3 }}>
          {Array.from({ length: 7 }, (_, row) => {
            const v = values[col * 7 + row] ?? 0;
            return (
              <View key={row} style={{
                aspectRatio: 1, borderRadius: 3,
                backgroundColor: COLORS.ink1,
                opacity: opacities[v] ?? 0.06,
              }} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Pill button ─────────────────────────────────────────────────
interface PillProps {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}
export function Pill({ children, active, onPress, style }: PillProps) {
  return (
    <Pressable onPress={onPress} style={[{
      backgroundColor: active ? COLORS.ink1 : 'transparent',
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
    }, style]}>
      <Text style={{
        fontFamily: undefined,
        fontSize: 13, fontWeight: '500',
        color: active ? COLORS.paper : COLORS.ink2,
        letterSpacing: -0.1,
      }}>{children}</Text>
    </Pressable>
  );
}

// ─── Check circle ────────────────────────────────────────────────
interface CheckProps {
  done: boolean;
  sphere: SphereId;
  onPress?: () => void;
  size?: number;
}
export function Check({ done, sphere, onPress, size = 22 }: CheckProps) {
  const s = SPHERE_COLORS[sphere];
  return (
    <TouchableOpacity onPress={onPress} style={{
      width: size, height: size, borderRadius: size,
      borderWidth: 1.5,
      borderColor: done ? s.accent : COLORS.ink5,
      backgroundColor: done ? s.accent : 'transparent',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {done && (
        <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12">
          <Path d="M2.5 6.5l2.3 2.3L9.5 3.5" stroke="white" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}
