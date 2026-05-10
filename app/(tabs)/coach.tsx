import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPHERE_COLORS } from '../../constants/theme';
import { SPHERE_LIST, SCORE_HISTORY, COACH_INSIGHTS, GOALS, VISION_CAPTIONS } from '../../constants/data';
import { SectionLabel, Card, SphereChip, Spark, Pill, F } from '../../components/ui';
import { useStore } from '../../store';
import { useFutureSelf, type FutureLetter, type FutureLetterHorizon } from '../../store/future-self';

const VISION_TONES: Record<string, [string, string]> = {
  g1: ['#E8D5C5', '#C4A593'],
  g2: ['#E8E2D5', '#C9C0AE'],
  g3: ['#D8DEE0', '#A0AAAE'],
  g4: ['#E8D8DC', '#BB9BA0'],
};

type CoachTab = 'insights' | 'weekly' | 'vision' | 'replay' | 'future';

export default function CoachScreen() {
  const [tab, setTab] = useState<CoachTab>('insights');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: COLORS.ink3 }}>
          Updated 3 hours ago · ✦ AI
        </Text>
        <Text style={{ fontFamily: F.display, fontSize: 44, color: COLORS.ink1, letterSpacing: -0.8, lineHeight: 52, marginTop: 8, marginBottom: 16 }}>
          Coach.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 6, paddingBottom: 6 }}>
        {([['insights', 'Insights'], ['weekly', 'Weekly'], ['vision', 'Vision'], ['replay', 'Replay'], ['future', 'Future']] as [CoachTab, string][]).map(([k, l]) => (
          <Pill key={k} active={tab === k} onPress={() => setTab(k)}>{l}</Pill>
        ))}
      </ScrollView>

      {tab === 'insights' && <CoachInsights />}
      {tab === 'weekly'   && <WeeklyReflection />}
      {tab === 'vision'   && <VisionBoard />}
      {tab === 'replay'   && <LifeReplay />}
      {tab === 'future'   && <FutureSelf />}
    </ScrollView>
  );
}

function CoachInsights() {
  const { state, dispatch } = useStore();
  const [reply, setReply] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const send = () => {
    const text = reply.trim();
    if (!text) return;
    dispatch({ type: 'SEND_COACH_MESSAGE', text });
    setReply('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <>
      <SectionLabel action="12 weeks">Sphere history</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={16}>
          {SPHERE_LIST.map((id, i) => {
            const s = SPHERE_COLORS[id];
            const data = SCORE_HISTORY[id];
            const cur = data[data.length - 1];
            const prev = data[data.length - 2];
            const trend = cur - prev;
            return (
              <View key={id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 10,
                borderTopWidth: i ? 0.5 : 0, borderTopColor: COLORS.ink7,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 110 }}>
                  <SphereChip sphere={id} size={20} />
                  <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink1, fontWeight: '500' }}>{s.label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Spark data={data} color={s.accent} w={120} h={32} />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 14, color: COLORS.ink1 }}>{cur}</Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, color: trend >= 0 ? SPHERE_COLORS.finance.accent : SPHERE_COLORS.health.accent, letterSpacing: 0.5 }}>
                    {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      <SectionLabel>Personalized insights</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 10 }}>
        {COACH_INSIGHTS.map((c, i) => {
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
  const wins = [
    { t: 'Shipped design system token migration', s: 'career' as const },
    { t: 'Hit 47-day meditation streak',          s: 'health' as const },
    { t: 'Cut $42/mo recurring subscription',     s: 'finance' as const },
  ];
  const challenges = [
    { t: 'Skipped two strength sessions',        s: 'health' as const },
    { t: 'Didn\'t schedule call with Priya',     s: 'relationships' as const },
  ];
  return (
    <>
      <SectionLabel action="May 3 – 9">Week in review</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={22}>
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}>
            {[{ n: '+12', l: 'Career Δ' }, { n: '5/7', l: 'habit days' }, { n: '3', l: 'milestones' }].map((s, i) => (
              <View key={i} style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.display, fontSize: 34, color: COLORS.ink1, lineHeight: 38 }}>{s.n}</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.ink3, marginTop: 4 }}>{s.l}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: F.displayItalic, fontSize: 19, lineHeight: 27, color: COLORS.ink1, letterSpacing: -0.2 }}>
            "A quiet, productive week. The work moved; the body moved; the heart was patient with itself."
          </Text>
        </Card>
      </View>
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
      <SectionLabel>Next step (coach pick)</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Card pad={20} style={{ backgroundColor: COLORS.ink1 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(244,239,230,0.55)' }}>Sunday, 10am</Text>
          <Text style={{ fontFamily: F.displayItalic, fontSize: 21, lineHeight: 28, marginTop: 8, color: COLORS.paper, letterSpacing: -0.2 }}>
            Block 45 minutes for Priya. Not a list — just one named human, one named time.
          </Text>
          <TouchableOpacity
            onPress={() => Alert.alert('Added to calendar', 'Sunday 10am — Call Priya')}
            style={{ marginTop: 14, backgroundColor: COLORS.paper, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99, alignSelf: 'flex-start' }}
          >
            <Text style={{ fontFamily: undefined, fontSize: 12, color: COLORS.ink1, fontWeight: '500' }}>Add to calendar</Text>
          </TouchableOpacity>
        </Card>
      </View>
    </>
  );
}

function VisionBoard() {
  const goalVisions = GOALS.map(g => ({
    goal: g,
    caption: VISION_CAPTIONS[g.id],
    tone: VISION_TONES[g.id] ?? ['#E8E2D5', '#C9C0AE'] as [string, string],
  }));

  return (
    <>
      <SectionLabel action="Regenerate ↻">Vision board</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <Text style={{ fontFamily: undefined, fontSize: 13, color: COLORS.ink3, lineHeight: 19, marginBottom: 14, letterSpacing: -0.1 }}>
          One image per active goal. Generated from what you said you wanted, not photographs.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {goalVisions.map((v, i) => {
            const s = SPHERE_COLORS[v.goal.sphere];
            return (
              <LinearGradient
                key={v.goal.id}
                colors={v.tone}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: '47%', aspectRatio: 1 / 1.15, borderRadius: 18, overflow: 'hidden', position: 'relative' }}
              >
                <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SphereChip sphere={v.goal.sphere} size={22} style={{ backgroundColor: 'rgba(255,255,255,0.75)' }} />
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(30,25,20,0.7)' }}>Goal {i + 1}</Text>
                  </View>
                </View>
                <View style={{ position: 'absolute', bottom: 14, left: 14, right: 14 }}>
                  <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(30,25,20,0.65)', marginBottom: 4 }} numberOfLines={2}>
                    {v.goal.title}
                  </Text>
                  <Text style={{ fontFamily: F.displayItalic, fontSize: 13, lineHeight: 17, color: 'rgba(20,15,10,0.92)', letterSpacing: -0.1 }}>
                    {v.caption}
                  </Text>
                </View>
              </LinearGradient>
            );
          })}
        </View>
      </View>

      <SectionLabel>Affirmations queue</SectionLabel>
      <View style={{ paddingHorizontal: 22, gap: 8 }}>
        {[
          { q: 'I move toward what I want with steady, ordinary courage.',  s: 'finance' as const },
          { q: 'My body keeps showing up. I show up back.',                  s: 'health' as const },
          { q: 'The work I do matters because the people around it do.',    s: 'career' as const },
        ].map((a, i) => (
          <Card key={i} pad={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SphereChip sphere={a.s} size={20} />
            <Text style={{ fontFamily: F.displayItalic, fontSize: 15, color: COLORS.ink1, flex: 1, lineHeight: 20, letterSpacing: -0.1 }}>{a.q}</Text>
          </Card>
        ))}
      </View>
    </>
  );
}

function LifeReplay() {
  const months = [
    { m: 'April 2026',    win: 'Built a 47-day meditation streak.',           challenge: 'Skipped strength sessions twice.',          lesson: 'Movement unlocks reflection — not the other way round.', tone: ['#E8D5C5', '#C4A593'] as [string, string] },
    { m: 'March 2026',    win: 'Shipped the design system v1 milestone.',     challenge: 'Drifted from finance habits in week 3.',     lesson: 'Career flow is real — protect it without losing the rest.', tone: ['#D8DEE0', '#A0AAAE'] as [string, string] },
    { m: 'February 2026', win: 'First $5,000 saved.',                         challenge: 'Two journal-empty weeks.',                   lesson: 'Money quiet means I can be quiet too.', tone: ['#E8E2D5', '#C9C0AE'] as [string, string] },
    { m: 'January 2026',  win: 'Kicked off four spheres at once.',            challenge: 'Over-planned, under-rested.',                lesson: 'Choose less; go deeper.', tone: ['#E8D8DC', '#BB9BA0'] as [string, string] },
  ];
  const [idx, setIdx] = useState(0);
  const m = months[idx];

  return (
    <>
      <SectionLabel action="Share →">Life replay</SectionLabel>
      <View style={{ paddingHorizontal: 22 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
          {months.map((mo, i) => (
            <Pill key={i} active={idx === i} onPress={() => setIdx(i)}>{mo.m.split(' ')[0]}</Pill>
          ))}
        </ScrollView>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <LinearGradient colors={m.tone} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 130 }}>
            <View style={{ position: 'absolute', bottom: 14, left: 18 }}>
              <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(30,25,20,0.55)' }}>Your growth story</Text>
              <Text style={{ fontFamily: F.displayItalic, fontSize: 28, lineHeight: 32, color: 'rgba(20,15,10,0.92)', letterSpacing: -0.5, marginTop: 4 }}>{m.m}</Text>
            </View>
          </LinearGradient>
          <View style={{ padding: 18 }}>
            {[
              { tag: 'Biggest win',   body: m.win,       c: SPHERE_COLORS.finance.accent },
              { tag: 'Top challenge', body: m.challenge, c: SPHERE_COLORS.health.accent  },
              { tag: 'Key lesson',    body: m.lesson,    c: SPHERE_COLORS.career.accent  },
            ].map((row, i) => (
              <View key={i} style={{ paddingVertical: 14, borderBottomWidth: i < 2 ? 0.5 : 0, borderBottomColor: COLORS.ink7 }}>
                <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: row.c, marginBottom: 6 }}>{row.tag}</Text>
                <Text style={{ fontFamily: F.displayItalic, fontSize: 17, lineHeight: 23, color: COLORS.ink1, letterSpacing: -0.1 }}>{row.body}</Text>
              </View>
            ))}
          </View>
        </Card>
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
