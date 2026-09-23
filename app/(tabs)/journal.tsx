import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SectionLabel, Card, SentimentChart, F } from '../../components/ui';
import { useStore } from '../../store';
import { buildJournalEntry } from '../../lib/journal-entry';
import { requestSentimentCheckIn } from '../../lib/nudges';
import { localDateISO, formatDisplayDate } from '../../lib/date';
import { sentimentSummary } from '../../lib/journal-stats';

export default function JournalScreen() {
  const { state, dispatch } = useStore();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visibleEntries = state.journal.filter(j => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (j.body ?? j.excerpt).toLowerCase().includes(q);
  });

  const { avg, delta, series } = sentimentSummary(state.journal, localDateISO());

  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const saveEntry = () => {
    const text = draft.trim();
    if (!text) return;
    dispatch({ type: 'ADD_JOURNAL', entry: buildJournalEntry(text, localDateISO()) });
    setDraft('');
    setComposing(false);
    // Fire-and-forget: may schedule a check-in if sentiment is trending down.
    requestSentimentCheckIn().catch(() => {});
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
          {avg === null ? (
            <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3, lineHeight: 19 }}>
              Your emotional trend will appear here once you've written a few entries.
            </Text>
          ) : (
            <>
              <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3 }}>Avg sentiment</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6, marginBottom: 6 }}>
                <Text style={{ fontFamily: F.display, fontSize: 36, color: COLORS.ink1, lineHeight: 40 }}>
                  {avg >= 0 ? '+' : '−'}{Math.abs(avg).toFixed(2)}
                </Text>
                {delta !== null && Math.abs(delta) >= 0.01 && (
                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: delta >= 0 ? SPHERE_COLORS.finance.accent : SPHERE_COLORS.health.accent, letterSpacing: 0.5 }}>
                    {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)} vs prior 30 days
                  </Text>
                )}
              </View>
              {series.length >= 2 ? (
                <>
                  <SentimentChart data={series.map(p => p.value)} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    {[series[0].date, series[series.length - 1].date].map(d => (
                      <Text key={d} style={{ fontFamily: F.mono, fontSize: 9, color: COLORS.ink4, letterSpacing: 1.5, textTransform: 'uppercase' }}>{formatDisplayDate(d)}</Text>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink3, marginTop: 4 }}>
                  Write on another day to see the trend line.
                </Text>
              )}
            </>
          )}
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
      <View style={{ paddingHorizontal: 22, paddingBottom: 10 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.ink7,
          borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
        }}>
          <Text style={{ fontSize: 13, color: COLORS.ink4 }}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search entries…"
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
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        {visibleEntries.length === 0 && (
          <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3, textAlign: 'center', paddingVertical: 12 }}>
            {query.trim().length > 0 ? `No entries match "${query}".` : 'No entries yet — write your first one above.'}
          </Text>
        )}
        {visibleEntries.map(j => {
          const isOpen = expanded.has(j.id);
          const sentColor = j.sentiment >= 0 ? SPHERE_COLORS.finance.accent : SPHERE_COLORS.health.accent;
          const sentLabel = j.sentiment > 0.5 ? 'bright' : j.sentiment > 0 ? 'gentle' : j.sentiment > -0.3 ? 'tender' : 'heavy';
          return (
            <TouchableOpacity key={j.id} activeOpacity={0.8} onPress={() => toggleExpanded(j.id)}>
            <Card pad={18}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, letterSpacing: 0.5 }}>{formatDisplayDate(j.date)}</Text>
                <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sentColor }} />
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3 }}>{sentLabel}</Text>
                </View>
              </View>
              <Text numberOfLines={isOpen ? undefined : 5} style={{ fontFamily: F.displayItalic, fontSize: 16, lineHeight: 23, color: COLORS.ink1, letterSpacing: -0.1 }}>
                {j.body ?? j.excerpt}
              </Text>
            </Card>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
