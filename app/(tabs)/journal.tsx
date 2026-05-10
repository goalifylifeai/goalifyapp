import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST, SENTIMENT } from '../../constants/data';
import { SectionLabel, Card, SphereChip, SentimentChart, Pill, F } from '../../components/ui';
import { useStore } from '../../store';
import type { SphereId } from '../../constants/theme';

function formatDate(): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function roughSentiment(text: string): number {
  const positive = /\b(good|great|proud|happy|steady|moved|shipped|win|better|love|calm|grateful|strong|joy|excited)\b/gi;
  const negative = /\b(hard|miss|fail|sad|tired|struggle|heavy|guilt|hurt|anxiety|worried|stuck|low|skip)\b/gi;
  const pos = (text.match(positive) ?? []).length;
  const neg = (text.match(negative) ?? []).length;
  const base = (pos - neg) / (pos + neg + 3);
  return Math.min(Math.max(base, -0.9), 0.9);
}

export default function JournalScreen() {
  const { state, dispatch } = useStore();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftSphere, setDraftSphere] = useState<SphereId>('career');

  const saveEntry = () => {
    const text = draft.trim();
    if (!text) return;
    dispatch({
      type: 'ADD_JOURNAL',
      entry: {
        id: `j-${Date.now()}`,
        date: formatDate(),
        sphere: draftSphere,
        sentiment: roughSentiment(text),
        excerpt: text.length > 140 ? text.slice(0, 138) + '…' : text,
      },
    });
    setDraft('');
    setComposing(false);
  };

  const cancelCompose = () => { setDraft(''); setComposing(false); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          {state.journal.length} entries
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8 }}>
          Journal.
        </Text>
      </View>

      {/* Sentiment chart */}
      <SectionLabel action="30 days">Emotional trend</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={18}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
            <View>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 }}>Avg sentiment</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <Text style={{ fontFamily: F.display, fontSize: 36, color: COLORS.ink1, lineHeight: 40 }}>+0.34</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 11, color: SPHERE_COLORS.finance.accent, letterSpacing: 0.5 }}>↑ 18%</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 1.5, textTransform: 'uppercase' }}>Highest</Text>
              <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, marginTop: 4, fontWeight: '500' }}>Career</Text>
            </View>
          </View>
          <SentimentChart data={SENTIMENT} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {['Apr 10', 'Apr 25', 'May 9'].map(d => (
              <Text key={d} style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink4, letterSpacing: 1.5, textTransform: 'uppercase' }}>{d}</Text>
            ))}
          </View>
        </Card>
      </View>

      {/* AI synthesis */}
      <SectionLabel>This week, in patterns</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={20} style={{ backgroundColor: COLORS.ink1 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(244,239,230,0.6)' }}>✦ AI synthesis</Text>
          <Text style={{ fontFamily: F.displayItalic, fontSize: 17, lineHeight: 24, marginTop: 10, color: COLORS.paper, letterSpacing: -0.1 }}>
            Career writing has gotten warmer; relationships, quieter. There's a soft signal here — when the work is going well, you reach out less.
          </Text>
        </Card>
      </View>

      {/* Compose / entry button */}
      {!composing ? (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <TouchableOpacity
            onPress={() => setComposing(true)}
            style={{
              backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.ink7,
              borderRadius: 18, padding: 18,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.ink7, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: COLORS.ink2, fontSize: 14 }}>✎</Text>
            </View>
            <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink3 }}>What's alive in you today?</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 22, paddingTop: 24 }}>
          <Card pad={16} style={{ borderWidth: 1, borderColor: COLORS.ink7 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {SPHERE_LIST.map(id => (
                <Pill key={id} active={draftSphere === id} onPress={() => setDraftSphere(id)}>
                  <Text style={{ color: draftSphere === id ? COLORS.paper : SPHERE_COLORS[id].deep }}>{SPHERE_COLORS[id].glyph} </Text>
                  {SPHERE_COLORS[id].label}
                </Pill>
              ))}
            </ScrollView>
            <TextInput
              autoFocus
              multiline
              value={draft}
              onChangeText={setDraft}
              placeholder="Write freely. AI will read for sentiment, never for judgment."
              placeholderTextColor={COLORS.ink4}
              style={{
                fontFamily: 'InstrumentSerif_400Regular_Italic',
                fontSize: 18, lineHeight: 27, color: COLORS.ink1,
                minHeight: 120, marginTop: 10,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4 }}>{draft.length} chars</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={cancelCompose} style={{ padding: 8 }}>
                  <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveEntry}
                  style={{ backgroundColor: COLORS.ink1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99 }}
                >
                  <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.paper, fontWeight: '500' }}>Save entry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Past entries */}
      <SectionLabel>Recent entries</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        {state.journal.map(j => {
          const s = SPHERE_COLORS[j.sphere];
          const sentColor = j.sentiment >= 0 ? SPHERE_COLORS.finance.accent : SPHERE_COLORS.health.accent;
          const sentLabel = j.sentiment > 0.5 ? 'bright' : j.sentiment > 0 ? 'gentle' : j.sentiment > -0.3 ? 'tender' : 'heavy';
          return (
            <Card key={j.id} pad={18}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <SphereChip sphere={j.sphere} size={20} />
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 2, textTransform: 'uppercase' }}>{s.label}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4 }}>·</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>{j.date}</Text>
                <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sentColor }} />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>{sentLabel}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: F.displayItalic, fontSize: 16, lineHeight: 23, color: COLORS.ink1, letterSpacing: -0.1 }}>{j.excerpt}</Text>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}
