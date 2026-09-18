import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import { useProfile } from './profile';
import { generateInviteCode } from '../lib/circles';
import { localDateISO } from '../lib/date';

export type Circle = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

/** The only per-member signal ever surfaced: today's must-do status + streak. */
export type CircleMemberStatus = {
  user_id: string;
  display_name: string;
  must_do_done: boolean;
  streak: number;
};

type CirclesContextValue = {
  circles: Circle[];
  loading: boolean;
  error: string | null;
  membersFor: (circleId: string) => CircleMemberStatus[];
  loadMembers: (circleId: string) => Promise<void>;
  createCircle: (name: string) => Promise<{ error: string | null }>;
  joinCircle: (code: string) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
};

const CirclesContext = createContext<CirclesContextValue | null>(null);

const CIRCLE_COLUMNS = 'id, name, invite_code, created_by, created_at';
const MAX_INVITE_CODE_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: { code?: string } | null | undefined): boolean {
  return err?.code === UNIQUE_VIOLATION;
}

export function CirclesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [membersByCircle, setMembersByCircle] = useState<Record<string, CircleMemberStatus[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCircles([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('circles')
      .select(CIRCLE_COLUMNS)
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setCircles((data ?? []) as Circle[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMembers = useCallback(async (circleId: string) => {
    const today = localDateISO();
    const [membersRes, statusRes] = await Promise.all([
      supabase.from('circle_members').select('user_id, display_name').eq('circle_id', circleId),
      supabase
        .from('circle_daily_status')
        .select('user_id, must_do_done, streak')
        .eq('circle_id', circleId)
        .eq('date', today),
    ]);
    if (membersRes.error) {
      setError(membersRes.error.message);
      return;
    }
    if (statusRes.error) {
      setError(statusRes.error.message);
      return;
    }
    const statusByUser = new Map(
      ((statusRes.data ?? []) as { user_id: string; must_do_done: boolean; streak: number }[]).map(s => [s.user_id, s]),
    );
    const merged: CircleMemberStatus[] = ((membersRes.data ?? []) as { user_id: string; display_name: string }[]).map(
      m => {
        const status = statusByUser.get(m.user_id);
        return {
          user_id: m.user_id,
          display_name: m.display_name,
          must_do_done: status?.must_do_done ?? false,
          streak: status?.streak ?? 0,
        };
      },
    );
    setMembersByCircle(prev => ({ ...prev, [circleId]: merged }));
  }, []);

  const membersFor = useCallback(
    (circleId: string) => membersByCircle[circleId] ?? [],
    [membersByCircle],
  );

  const createCircle = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Not signed in' };
      const trimmed = name.trim();
      if (!trimmed) return { error: 'Give your circle a name.' };
      const displayName = profile?.display_name || 'Member';

      for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
        const inviteCode = generateInviteCode();
        const { data, error: err } = await supabase
          .from('circles')
          .insert({ name: trimmed, invite_code: inviteCode, created_by: user.id })
          .select(CIRCLE_COLUMNS)
          .single();

        if (err) {
          if (isUniqueViolation(err)) continue;
          return { error: err.message };
        }

        const circle = data as Circle;
        const { error: memberErr } = await supabase
          .from('circle_members')
          .insert({ circle_id: circle.id, user_id: user.id, display_name: displayName });
        if (memberErr) return { error: memberErr.message };

        setCircles(prev => [circle, ...prev]);
        return { error: null };
      }

      return { error: 'Could not generate a unique invite code. Please try again.' };
    },
    [user, profile],
  );

  const joinCircle = useCallback(
    async (code: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Not signed in' };
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return { error: 'Enter an invite code.' };

      const { data, error: lookupErr } = await supabase.rpc('lookup_circle_by_code', { p_code: trimmed });
      if (lookupErr) return { error: lookupErr.message };

      const found = (Array.isArray(data) ? data[0] : data) as { id: string; name: string } | null | undefined;
      if (!found) return { error: "That invite code doesn't match any circle." };

      const displayName = profile?.display_name || 'Member';
      const { error: joinErr } = await supabase
        .from('circle_members')
        .insert({ circle_id: found.id, user_id: user.id, display_name: displayName });

      if (joinErr) {
        if (isUniqueViolation(joinErr)) return { error: 'You are already a member of this circle.' };
        return { error: joinErr.message };
      }

      await refresh();
      return { error: null };
    },
    [user, profile, refresh],
  );

  const value = useMemo<CirclesContextValue>(
    () => ({ circles, loading, error, membersFor, loadMembers, createCircle, joinCircle, refresh }),
    [circles, loading, error, membersFor, loadMembers, createCircle, joinCircle, refresh],
  );

  return <CirclesContext.Provider value={value}>{children}</CirclesContext.Provider>;
}

export function useCircles(): CirclesContextValue {
  const ctx = useContext(CirclesContext);
  if (!ctx) throw new Error('useCircles must be called inside <CirclesProvider>');
  return ctx;
}
