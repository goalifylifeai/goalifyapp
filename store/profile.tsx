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

export type Profile = {
  user_id: string;
  display_name: string;
  pronouns: string | null;
  gender_aware_coaching: boolean;
  avatar_url: string | null;
  updated_at: string;
};

export type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'pronouns' | 'gender_aware_coaching'>>;

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  update: (patch: ProfilePatch) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const COLUMNS = 'user_id, display_name, pronouns, gender_aware_coaching, avatar_url, updated_at';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('profiles')
      .select(COLUMNS)
      .eq('user_id', user.id)
      .single();
    if (err) setError(err.message);
    else setProfile(data as Profile);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const update = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return { error: 'Not signed in' };
      const { data, error: err } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', user.id)
        .select(COLUMNS)
        .single();
      if (err) return { error: err.message };
      setProfile(data as Profile);
      return { error: null };
    },
    [user],
  );

  const deleteAccount = useCallback(async () => {
    const { error: err } = await supabase.functions.invoke('delete-account');
    if (err) return { error: err.message };
    await supabase.auth.signOut();
    return { error: null };
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, loading, error, refresh: fetchProfile, update, deleteAccount }),
    [profile, loading, error, fetchProfile, update, deleteAccount],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be called inside <ProfileProvider>');
  return ctx;
}
