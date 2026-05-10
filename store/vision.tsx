import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import type { SphereId } from '../constants/theme';
import { type VisionStage } from '../lib/vision-stage';
import { PRO_VISION_REGEN } from '../constants/flags';

export type VisionAssetStatus = 'pending' | 'generating' | 'ready' | 'error';

export type VisionAsset = {
  id: string;
  goal_id: string;
  stage: VisionStage;
  storage_path: string;
  prompt_hash: string;
  seed: number;
  status: VisionAssetStatus;
  error_msg: string | null;
  generated_at: string | null;
  last_regen_at: string | null;
  regen_count: number;
};

type SignedEntry = { url: string; expiresAt: number };

// keyed as `${goalId}:${stage}`
type AssetMap = Record<string, VisionAsset | undefined>;
type UrlMap   = Record<string, SignedEntry | undefined>;

const SIGNED_URL_TTL_S = 7200; // 2 hours
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const REGEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type VisionContextValue = {
  getAsset: (goalId: string, stage: VisionStage) => VisionAsset | undefined;
  getSignedUrl: (goalId: string, stage: VisionStage) => string | undefined;
  requestGeneration: (goalId: string, goalTitle: string, sphere: SphereId) => void;
  requestRegen: (goalId: string, stage: VisionStage, goalTitle: string, sphere: SphereId) => void;
  canRegen: (goalId: string, stage: VisionStage) => boolean;
  isGenerating: (goalId: string) => boolean;
};

const VisionContext = createContext<VisionContextValue | null>(null);

const assetKey = (goalId: string, stage: VisionStage) => `${goalId}:${stage}`;

export function VisionAssetsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetMap>({});
  const [urls, setUrls] = useState<UrlMap>({});
  const generating = useRef<Set<string>>(new Set()); // goalIds currently generating

  const fetchAllAssets = useCallback(async () => {
    if (!user) { setAssets({}); return; }
    const { data, error } = await supabase
      .from('vision_assets')
      .select('*')
      .eq('user_id', user.id);
    if (error || !data) return;
    const map: AssetMap = {};
    for (const row of data as VisionAsset[]) {
      map[assetKey(row.goal_id, row.stage)] = row;
    }
    setAssets(map);
  }, [user]);

  useEffect(() => { fetchAllAssets(); }, [fetchAllAssets]);

  const resolveSignedUrl = useCallback(async (asset: VisionAsset) => {
    if (!asset.storage_path || asset.status !== 'ready') return;
    const key = assetKey(asset.goal_id, asset.stage);
    const cached = urls[key];
    if (cached && cached.expiresAt > Date.now() + SIGNED_URL_REFRESH_BUFFER_MS) return;
    const { data } = await supabase.storage
      .from('vision-assets')
      .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_S);
    if (data?.signedUrl) {
      setUrls(prev => ({
        ...prev,
        [key]: { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_S * 1000 },
      }));
    }
  }, [urls]);

  // Resolve signed URLs for any ready assets that don't have one yet.
  useEffect(() => {
    for (const asset of Object.values(assets)) {
      if (asset?.status === 'ready') resolveSignedUrl(asset);
    }
  }, [assets, resolveSignedUrl]);

  const requestGeneration = useCallback((goalId: string, goalTitle: string, sphere: SphereId) => {
    if (!user) return;
    if (generating.current.has(goalId)) return;
    // Check if all 4 stages are already ready — skip if so.
    const stages: VisionStage[] = [0, 1, 2, 3];
    const allReady = stages.every(s => assets[assetKey(goalId, s)]?.status === 'ready');
    if (allReady) return;

    generating.current.add(goalId);
    // Mark pending rows locally so banner shows shimmer immediately.
    setAssets(prev => {
      const next = { ...prev };
      for (const s of stages) {
        const k = assetKey(goalId, s);
        if (!next[k]) {
          next[k] = {
            id: '', goal_id: goalId, stage: s,
            storage_path: '', prompt_hash: '', seed: 0,
            status: 'pending', error_msg: null,
            generated_at: null, last_regen_at: null, regen_count: 0,
          };
        }
      }
      return next;
    });

    supabase.functions
      .invoke('generate-vision', { body: { goal_id: goalId, goal_title: goalTitle, sphere } })
      .then(({ data, error }) => {
        generating.current.delete(goalId);
        if (error || !data) return;
        // Merge returned assets into state.
        setAssets(prev => {
          const next = { ...prev };
          for (const row of data as VisionAsset[]) {
            next[assetKey(row.goal_id, row.stage)] = row;
          }
          return next;
        });
      })
      .catch(() => { generating.current.delete(goalId); });
  }, [user, assets]);

  const requestRegen = useCallback((goalId: string, stage: VisionStage, goalTitle: string, sphere: SphereId) => {
    if (!user) return;
    const asset = assets[assetKey(goalId, stage)];
    if (!canRegenAsset(asset)) return;

    setAssets(prev => ({
      ...prev,
      [assetKey(goalId, stage)]: prev[assetKey(goalId, stage)]
        ? { ...prev[assetKey(goalId, stage)]!, status: 'generating' }
        : undefined,
    }));

    supabase.functions
      .invoke('generate-vision', { body: { goal_id: goalId, goal_title: goalTitle, sphere, regen: true, regen_stage: stage } })
      .then(({ data, error }) => {
        if (error || !data) return;
        setAssets(prev => {
          const next = { ...prev };
          for (const row of data as VisionAsset[]) {
            next[assetKey(row.goal_id, row.stage)] = row;
          }
          return next;
        });
        // Invalidate cached signed URL so it refreshes with the new path.
        setUrls(prev => { const n = { ...prev }; delete n[assetKey(goalId, stage)]; return n; });
      })
      .catch(() => {});
  }, [user, assets]);

  const canRegenAsset = (asset: VisionAsset | undefined): boolean => {
    if (!asset) return false;
    if (PRO_VISION_REGEN) return true;
    if (!asset.last_regen_at) return true;
    return Date.now() - new Date(asset.last_regen_at).getTime() > REGEN_COOLDOWN_MS;
  };

  const value = useMemo<VisionContextValue>(() => ({
    getAsset: (goalId, stage) => assets[assetKey(goalId, stage)],
    getSignedUrl: (goalId, stage) => urls[assetKey(goalId, stage)]?.url,
    requestGeneration,
    requestRegen,
    canRegen: (goalId, stage) => canRegenAsset(assets[assetKey(goalId, stage)]),
    isGenerating: (goalId) => generating.current.has(goalId),
  }), [assets, urls, requestGeneration, requestRegen]);

  return <VisionContext.Provider value={value}>{children}</VisionContext.Provider>;
}

export function useVisionAssets(): VisionContextValue {
  const ctx = useContext(VisionContext);
  if (!ctx) throw new Error('useVisionAssets must be called inside <VisionAssetsProvider>');
  return ctx;
}
