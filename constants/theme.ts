// Goalify design tokens — converted from oklch to hex for React Native

export const COLORS = {
  // Paper / background
  paper: '#F4EFE6',
  surface: '#FAF6EE',
  surfaceWarm: '#EFE6D6',

  // Ink scale
  ink1: '#1F1B17',
  ink2: '#3F372F',
  ink3: '#7C7166',
  ink4: '#A8998A',
  ink5: '#C8BCAC',
  ink6: '#E5DDCD',
  ink7: '#EBE2D2',

  // Accent warm (oklch 0.62 0.11 50 → warm terracotta)
  accentWarm: '#B5703B',

  // Dark theme
  dark: {
    paper: '#1A1612',
    surface: '#221E18',
    surfaceWarm: '#2C2620',
    ink1: '#F4EFE6',
    ink2: '#D8D0C2',
    ink3: '#9A8E7F',
    ink4: '#736A5C',
    ink5: '#5A5246',
    ink6: '#3A352C',
    ink7: '#2D2820',
  },
};

export const SPHERE_COLORS = {
  finance: {
    // oklch(0.58 0.09 145) sage green
    accent: '#4E7A56',
    // oklch(0.93 0.04 145)
    soft: '#E6F0E7',
    // oklch(0.32 0.06 145)
    deep: '#27432C',
    glyph: '$',
    label: 'Finance',
  },
  health: {
    // oklch(0.62 0.11 25) warm clay
    accent: '#A86432',
    // oklch(0.93 0.04 25)
    soft: '#F5EBE4',
    // oklch(0.34 0.07 25)
    deep: '#5C331A',
    glyph: '+',
    label: 'Health',
  },
  career: {
    // oklch(0.55 0.09 250) slate blue
    accent: '#4C5E9C',
    // oklch(0.93 0.03 250)
    soft: '#E6E8F3',
    // oklch(0.30 0.06 250)
    deep: '#282E5A',
    glyph: '△',
    label: 'Career',
  },
  relationships: {
    // oklch(0.58 0.09 340) rose
    accent: '#964060',
    // oklch(0.94 0.03 340)
    soft: '#F4E8ED',
    // oklch(0.33 0.06 340)
    deep: '#4A1E32',
    glyph: '○',
    label: 'Relationships',
  },
} as const;

export type SphereId = keyof typeof SPHERE_COLORS;

export const FONTS = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  ui: undefined as undefined, // System font
};
