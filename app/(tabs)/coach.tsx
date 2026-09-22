import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_VISION_CAPTIONS, SPHERE_VISION_TONES } from '../../constants/data';
import { SectionLabel, Card, SphereChip, Pill, F } from '../../components/ui';
import { VisionBanner } from '../../components/vision/VisionBanner';
import { useStore } from '../../store';
import { useFutureSelf, type FutureLetter, type FutureLetterHorizon } from '../../store/future-self';
import { useCoachAi, CoachLimitError } from '../../store/coach-ai';

type CoachTab = 'insights' | 'weekly' | 'vision' | 'future';

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function CoachScreen() {
  const [tab, setTab] = useState<CoachTab>('insights');
  const { insightsUpdatedAt } = useCoachAi();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          {insightsUpdatedAt ? `Updated ${timeAgo(insightsUpdatedAt)}` : 'Your coach'} · ✦ AI
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8, marginBottom: 16 }}>
          Coach.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 6, paddingBottom: 6 }}>
        {([['insights', 'Insights'], ['weekly', 'Weekly'], ['vision', 'Vision'], ['future', 'Future']] as [CoachTab, string][]).map(([k, l]) => (
          <Pill key={k} active={tab === k} onPress={() => setTab(k)}>{l}</Pill>
        ))}
      </ScrollView>

      {tab === 'insights' && <CoachInsights />}
      {tab === 'weekly'   && <WeeklyReflection />}
      {tab === 'vision'   && <VisionBoard />}
      {tab === 'future'   && <FutureSelf />}
    </ScrollView>
  );
}

function CoachInsights() {
  const { state, dispatch } = useStore();
  const { insights, insightsLoading, askCoach } = useCoachAi();
  const [reply, setReply] = useState('');
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = () => {
    const text = reply.trim();
    if (!text || asking) return;
    dispatch({ type: 'ADD_USER_MESSAGE', text });
    setReply('');
    setAsking(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    askCoach(text)
      .then(coachReply => dispatch({ type: 'ADD_COACH_REPLY', text: coachReply }))
      .catch(err => dispatch({
        type: 'ADD_COACH_REPLY',
        text: err instanceof CoachLimitError ? err.message : "I couldn't reach your coach just now — try again in a moment.",
      }))
      .finally(() => {
        setAsking(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      });
  };

  return (
    <>
      <SectionLabel>Personalized insights</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        {insightsLoading && !insights && (
          <Card pad={20}><Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Reading your goals, habits and journal…</Text></Card>
        )}
        {!insightsLoading && insights?.length === 0 && (
          <Card pad={20}><Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>No insights yet — check back once you've logged a bit more.</Text></Card>
        )}
        {(insights ?? []).map((c, i) => {
          const tag = c.kind === 'win' ? SPHERE_COLORS.finance.accent : c.kind === 'nudge' ? SPHERE_COLORS.health.accent : SPHERE_COLORS.career.accent;
          const label = c.kind === 'win' ? 'compounding win' : c.kind === 'nudge' ? 'gentle nudge' : 'pattern';
          return (
            <Card key={i} pad={20} style={{ position: 'relative', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: tag, borderTopLeftRadius: 18, borderTopRightRadius: 18 }} />
              <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: tag }}>{label}</Text>
              <Text style={{ fontFamily: F.display, fontSize: 20, lineHeight: 24, color: COLORS.ink1, marginTop: 8, letterSpacing: -0.2 }}>{c.title}</Text>
              <Text style={{ fontFamily: undefined, fontSize: 14, lineHeight: 21, color: COLORS.ink2, marginTop: 8, letterSpacing: -0.1 }}>{c.body}</Text>
            </Card>
          );
        })}
      </View>

      <SectionLabel>Ask your coach</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={4} style={{ backgroundColor: COLORS.surface }}>
          <ScrollView ref={scrollRef} style={{ maxHeight: 300 }}>
            <View style={{ padding: 16, gap: 10 }}>
              {state.coachMessages.map(msg => (
                <View
                  key={msg.id}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    backgroundColor: msg.role === 'user' ? COLORS.ink1 : COLORS.ink7,
                    borderRadius: 14,
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
                    borderBottomLeftRadius: msg.role === 'coach' ? 4 : 14,
                    padding: 10,
                  }}
                >
                  <Text style={{ fontFamily: undefined, fontSize: 13.5, lineHeight: 20, color: msg.role === 'user' ? COLORS.paper : COLORS.ink1 }}>
                    {msg.text}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            margin: 8, padding: 10, borderRadius: 14, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.ink7,
          }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Ask anything…"
              placeholderTextColor={COLORS.ink4}
              style={{ flex: 1, fontFamily: undefined, fontSize: 13.5, color: COLORS.ink1 }}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={send}
              style={{ backgroundColor: reply.trim() ? COLORS.ink1 : COLORS.ink6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 }}
            >
              <Text style={{ fontFamily: undefined, fontSize: 12, color: reply.trim() ? COLORS.paper : COLORS.ink4, fontWeight: '500' }}>Send</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </>
  );
}

function WeeklyReflection() {
  const { weekly, weeklyLoading } = useCoachAi();

  if (weeklyLoading && !weekly) {
    return (
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Card pad={20}><Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>Putting your week together…</Text></Card>
      </View>
    );
  }
  if (!weekly) return null;

  const wins = weekly.wins ?? [];
  const challenges = weekly.challenges ?? [];

  return (
    <>
      <SectionLabel action={weekly.period}>Week in review</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={22}>
          {weekly.stats?.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}>
              {weekly.stats.map((s, i) => (
                <View key={i} style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.display, fontSize: 34, color: COLORS.ink1, lineHeight: 38 }}>{s.n}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, marginTop: 4 }}>{s.l}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={{ fontFamily: F.displayItalic, fontSize: 19, lineHeight: 27, color: COLORS.ink1, letterSpacing: -0.2 }}>
            "{weekly.quote}"
          </Text>
        </Card>
      </View>
      {wins.length > 0 && (
        <>
          <SectionLabel>Wins</SectionLabel>
          <View style={{ paddingHorizontal: 22, gap: 8 }}>
            {wins.map((w, i) => (
              <Card key={i} pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SphereChip sphere={w.s} size={22} />
                <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, flex: 1, letterSpacing: -0.1 }}>{w.t}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: SPHERE_COLORS.finance.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>+ win</Text>
              </Card>
            ))}
          </View>
        </>
      )}
      {challenges.length > 0 && (
        <>
          <SectionLabel>Challenges</SectionLabel>
          <View style={{ paddingHorizontal: 22, gap: 8 }}>
            {challenges.map((w, i) => (
              <Card key={i} pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <SphereChip sphere={w.s} size={22} />
                <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, flex: 1, letterSpacing: -0.1 }}>{w.t}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 10, color: SPHERE_COLORS.health.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>resist</Text>
              </Card>
            ))}
          </View>
        </>
      )}
      {weekly.next_step && (
        <>
          <SectionLabel>Next step (coach pick)</SectionLabel>
          <View style={{ paddingHorizontal: 22 }}>
            <Card pad={20} style={{ backgroundColor: COLORS.ink1 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(244,239,230,0.55)' }}>{weekly.next_step.when}</Text>
              <Text style={{ fontFamily: F.displayItalic, fontSize: 21, lineHeight: 28, marginTop: 8, color: COLORS.paper, letterSpacing: -0.2 }}>
                {weekly.next_step.title}
              </Text>
            </Card>
          </View>
        </>
      )}
    </>
  );
}

function VisionBoard() {
  const { state } = useStore();

  return (
    <>
      <SectionLabel>Vision board</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3, lineHeight: 19, marginBottom: 4, letterSpacing: -0.1 }}>
          One scene per goal that moves forward as you tick off its steps. Tap a goal to see every stage.
        </Text>
        {state.goals.length === 0 ? (
          <Card pad={20}>
            <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3 }}>
              Add a goal to start your vision board.
            </Text>
          </Card>
        ) : state.goals.map(g => (
          <Card key={g.id} pad={0} style={{ overflow: 'hidden' }}>
            <VisionBanner
              goalId={g.id}
              goalTitle={g.title}
              sphere={g.sphere}
              progress={g.progress}
              caption={SPHERE_VISION_CAPTIONS[g.sphere]}
              fallbackColors={SPHERE_VISION_TONES[g.sphere]}
              onPress={() => router.push(`/vision/${g.id}` as any)}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
              <SphereChip sphere={g.sphere} size={20} />
              <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, flex: 1 }} numberOfLines={1}>{g.title}</Text>
            </View>
          </Card>
        ))}
      </View>
    </>
  );
}

const HORIZON_LABELS: Record<FutureLetterHorizon, string> = {
  '1m': '1 month',
  '3m': '3 months',
  '6m': '6 months',
  '1y': '1 year',
};

const HORIZONS: FutureLetterHorizon[] = ['1m', '3m', '6m', '1y'];

const MAX_CHARS = 4000;

function WriteLetter({ onSaved }: { onSaved: () => void }) {
  const { saveLetter } = useFutureSelf();
  const [horizon, setHorizon] = useState<FutureLetterHorizon>('1y');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await saveLetter({ horizon, body: body.trim() });
    setBusy(false);
    if (err) { setError(err); return; }
    onSaved();
  };

  return (
    <View style={{ paddingHorizontal: 22 }}>
      <Card pad={18}>
        <Text style={{ fontFamily: F.display, fontSize: 22, color: COLORS.ink1, letterSpacing: -0.4, marginBottom: 4 }}>
          Write to your future self.
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1, color: COLORS.ink3, marginBottom: 16 }}>
          One year from now, what do you hope is true?
        </Text>

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {HORIZONS.map(h => (
            <TouchableOpacity
              key={h}
              onPress={() => setHorizon(h)}
              style={{
                paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
                backgroundColor: horizon === h ? COLORS.ink1 : COLORS.ink7,
              }}
            >
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: horizon === h ? COLORS.paper : COLORS.ink2 }}>
                {HORIZON_LABELS[h]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Dear future me…"
          placeholderTextColor={COLORS.ink4}
          multiline
          style={{
            fontFamily: F.displayItalic, fontSize: 15, color: COLORS.ink1,
            lineHeight: 24, minHeight: 120, textAlignVertical: 'top',
            borderWidth: 1, borderColor: COLORS.ink6, borderRadius: 8,
            padding: 12,
          }}
          maxLength={MAX_CHARS}
        />
        <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink4, textAlign: 'right', marginTop: 4 }}>
          {body.length} / {MAX_CHARS}
        </Text>

        {error && (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: '#A33', marginTop: 8 }}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={save}
          disabled={busy || !body.trim()}
          style={{
            marginTop: 14, paddingVertical: 14, borderRadius: 10,
            backgroundColor: COLORS.ink1, alignItems: 'center',
            opacity: busy || !body.trim() ? 0.4 : 1,
          }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: COLORS.paper }}>
            {busy ? 'Saving…' : 'Save letter'}
          </Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

function LetterModal({ letter, onClose }: { letter: FutureLetter; onClose: () => void }) {
  const openedAt = new Date(letter.created_at);
  const horizonMs: Record<FutureLetterHorizon, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
  const openDate = new Date(openedAt.getTime() + horizonMs[letter.horizon] * 86400000);
  const dateStr = openDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ padding: 28, paddingTop: 48 }}>
        <TouchableOpacity onPress={onClose} style={{ alignSelf: 'flex-end', marginBottom: 20 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.ink3 }}>Close</Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 6 }}>
          {HORIZON_LABELS[letter.horizon]} from now · opens {dateStr}
        </Text>
        <Text style={{ fontFamily: F.displayItalic, fontSize: 22, color: COLORS.ink1, lineHeight: 30, letterSpacing: -0.3 }}>
          {letter.body}
        </Text>
      </ScrollView>
    </Modal>
  );
}

function FutureSelf() {
  const { originalLetter, letters, loading } = useFutureSelf();
  const [activeHorizon, setActiveHorizon] = useState<FutureLetterHorizon>('1y');
  const [modalLetter, setModalLetter] = useState<FutureLetter | null>(null);
  const [writing, setWriting] = useState(false);

  const displayLetter = originalLetter ?? null;
  const horizon = displayLetter?.horizon ?? activeHorizon;

  const updates = letters.filter(l => l.letter_type !== 'original');

  if (loading) {
    return (
      <>
        <SectionLabel>Future self</SectionLabel>
        <View style={{ paddingHorizontal: 22 }}>
          <Card pad={18}>
            <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3 }}>Loading…</Text>
          </Card>
        </View>
      </>
    );
  }

  if (!displayLetter && !writing) {
    return (
      <>
        <SectionLabel>Future self</SectionLabel>
        <View style={{ paddingHorizontal: 22 }}>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <LinearGradient
              colors={['#3A3060', '#7A4030', '#C8A050']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: 160, justifyContent: 'flex-end', padding: 18 }}
            >
              <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,245,225,0.7)' }}>
                The temporal loop
              </Text>
              <Text style={{ fontFamily: F.displayItalic, fontSize: 26, lineHeight: 30, color: 'rgba(255,245,225,0.95)', letterSpacing: -0.5, marginTop: 4 }}>
                Where will your choices{'\n'}take you?
              </Text>
            </LinearGradient>
            <View style={{ padding: 18 }}>
              <Text style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, lineHeight: 21, marginBottom: 16 }}>
                Write a letter to your future self. One year from now, you'll see your original words next to what actually happened.
              </Text>
              <TouchableOpacity
                onPress={() => setWriting(true)}
                style={{ paddingVertical: 13, borderRadius: 10, backgroundColor: COLORS.ink1, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.mono, fontSize: 12, letterSpacing: 1, color: COLORS.paper }}>Write your letter</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </>
    );
  }

  if (writing) {
    return (
      <>
        <SectionLabel action="Cancel" onAction={() => setWriting(false)}>Future self</SectionLabel>
        <WriteLetter onSaved={() => setWriting(false)} />
      </>
    );
  }

  return (
    <>
      {modalLetter && (
        <LetterModal letter={modalLetter} onClose={() => setModalLetter(null)} />
      )}

      <SectionLabel>Future self</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 12 }}>

        {/* Header gradient with horizon scrubber */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <LinearGradient
            colors={['#3A3060', '#7A4030', '#C8A050']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ height: 140, justifyContent: 'flex-end', padding: 18 }}
          >
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(255,245,225,0.7)' }}>
              See where your choices take you
            </Text>
            <Text style={{ fontFamily: F.displayItalic, fontSize: 30, lineHeight: 34, color: 'rgba(255,245,225,0.95)', letterSpacing: -0.6, marginTop: 4 }}>
              {HORIZON_LABELS[horizon]} from now
            </Text>
          </LinearGradient>
          <View style={{ flexDirection: 'row', gap: 6, padding: 12, paddingBottom: 12 }}>
            {HORIZONS.map(h => (
              <TouchableOpacity
                key={h}
                onPress={() => setActiveHorizon(h)}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 99, alignItems: 'center',
                  backgroundColor: horizon === h ? COLORS.ink1 : COLORS.ink7,
                }}
              >
                <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, color: horizon === h ? COLORS.paper : COLORS.ink2 }}>
                  {HORIZON_LABELS[h]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Original letter card */}
        <TouchableOpacity onPress={() => setModalLetter(displayLetter)} activeOpacity={0.8}>
          <Card pad={18}>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 10 }}>
              Your letter · written {new Date(displayLetter!.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text
              numberOfLines={6}
              style={{ fontFamily: F.displayItalic, fontSize: 16, lineHeight: 24, color: COLORS.ink1, letterSpacing: -0.1 }}
            >
              {displayLetter!.body}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.ink3, marginTop: 10 }}>
              Tap to read in full →
            </Text>
          </Card>
        </TouchableOpacity>

        {/* Updates timeline */}
        {updates.length > 0 && (
          <>
            <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginTop: 4 }}>
              Progress updates
            </Text>
            {updates.map(u => (
              <TouchableOpacity key={u.id} onPress={() => setModalLetter(u)} activeOpacity={0.8}>
                <Card pad={16}>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.ink3, marginBottom: 8 }}>
                    {u.period_label ?? new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Text numberOfLines={3} style={{ fontFamily: undefined, fontSize: 14, color: COLORS.ink1, lineHeight: 21 }}>
                    {u.body}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Update your letter CTA */}
        <TouchableOpacity
          onPress={() => setWriting(true)}
          style={{ paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.ink3, letterSpacing: 0.5 }}>
            + Update your letter
          </Text>
        </TouchableOpacity>

      </View>
    </>
  );
}
