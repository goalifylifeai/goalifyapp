// ── Mocks ─────────────────────────────────────────────────────────
// jest.mock calls are hoisted before imports, so factory functions must be
// self-contained (no references to outer variables defined after hoisting).

jest.mock('../lib/circles', () => ({
  generateInviteCode: jest.fn(() => 'ABC234'),
}));

const mockUser = { id: 'user-1' };

jest.mock('../store/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('../store/profile', () => ({
  useProfile: () => ({ profile: { display_name: 'Ada' } }),
}));

function makeSupabaseMock() {
  const circlesInsertSingle = jest.fn();
  const circlesSelectOrder = jest.fn().mockResolvedValue({ data: [], error: null });
  const membersInsert = jest.fn().mockResolvedValue({ error: null });
  const membersSelect = jest.fn().mockResolvedValue({ data: [], error: null });
  const statusSelect = jest.fn().mockResolvedValue({ data: [], error: null });
  const rpc = jest.fn();

  const from = jest.fn((table: string) => {
    if (table === 'circles') {
      return {
        select: jest.fn(() => ({
          order: circlesSelectOrder,
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: circlesInsertSingle,
          })),
        })),
      };
    }
    if (table === 'circle_members') {
      return {
        select: jest.fn(() => ({
          eq: membersSelect,
        })),
        insert: membersInsert,
      };
    }
    if (table === 'circle_daily_status') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: statusSelect,
          })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    rpc,
    __mocks: { circlesInsertSingle, circlesSelectOrder, membersInsert, membersSelect, statusSelect, rpc },
  };
}

let mockSupabase = makeSupabaseMock();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => (mockSupabase.from as any)(...args),
    rpc: (...args: unknown[]) => (mockSupabase.rpc as any)(...args),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { CirclesProvider, useCircles } from '../store/circles';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(CirclesProvider, null, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase = makeSupabaseMock();
});

describe('createCircle', () => {
  it('inserts a circle with a generated invite code and self-joins as a member', async () => {
    mockSupabase.__mocks.circlesInsertSingle.mockResolvedValue({
      data: { id: 'c1', name: 'Morning Runners', invite_code: 'ABC234', created_by: 'user-1', created_at: 't' },
      error: null,
    });

    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: string | null } | undefined;
    await require('@testing-library/react-native').act(async () => {
      response = await result.current.createCircle('Morning Runners');
    });

    expect(response?.error).toBeNull();
    expect(mockSupabase.__mocks.membersInsert).toHaveBeenCalledWith({
      circle_id: 'c1',
      user_id: 'user-1',
      display_name: 'Ada',
    });
    expect(result.current.circles.map(c => c.id)).toContain('c1');
  });

  it('rejects an empty name without hitting the network', async () => {
    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: string | null } | undefined;
    await require('@testing-library/react-native').act(async () => {
      response = await result.current.createCircle('   ');
    });

    expect(response?.error).toBeTruthy();
    expect(mockSupabase.__mocks.circlesInsertSingle).not.toHaveBeenCalled();
  });

  it('retries with a fresh invite code on a unique-constraint conflict', async () => {
    const { generateInviteCode } = require('../lib/circles');
    (generateInviteCode as jest.Mock)
      .mockReturnValueOnce('ABC234')
      .mockReturnValueOnce('XYZ987');

    mockSupabase.__mocks.circlesInsertSingle
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key' } })
      .mockResolvedValueOnce({
        data: { id: 'c2', name: 'Book Club', invite_code: 'XYZ987', created_by: 'user-1', created_at: 't' },
        error: null,
      });

    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: string | null } | undefined;
    await require('@testing-library/react-native').act(async () => {
      response = await result.current.createCircle('Book Club');
    });

    expect(response?.error).toBeNull();
    expect(mockSupabase.__mocks.circlesInsertSingle).toHaveBeenCalledTimes(2);
  });
});

describe('joinCircle', () => {
  it('looks up the circle by code via RPC and inserts a membership row', async () => {
    mockSupabase.__mocks.rpc.mockResolvedValue({ data: [{ id: 'c9', name: 'Night Owls' }], error: null });

    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: string | null } | undefined;
    await require('@testing-library/react-native').act(async () => {
      response = await result.current.joinCircle('night9');
    });

    expect(response?.error).toBeNull();
    expect(mockSupabase.__mocks.rpc).toHaveBeenCalledWith('lookup_circle_by_code', { p_code: 'NIGHT9' });
    expect(mockSupabase.__mocks.membersInsert).toHaveBeenCalledWith({
      circle_id: 'c9',
      user_id: 'user-1',
      display_name: 'Ada',
    });
  });

  it('returns a friendly error for an unknown invite code', async () => {
    mockSupabase.__mocks.rpc.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: string | null } | undefined;
    await require('@testing-library/react-native').act(async () => {
      response = await result.current.joinCircle('NOPE99');
    });

    expect(response?.error).toBeTruthy();
    expect(mockSupabase.__mocks.membersInsert).not.toHaveBeenCalled();
  });

  it('returns a friendly error when already a member (unique-constraint violation)', async () => {
    mockSupabase.__mocks.rpc.mockResolvedValue({ data: [{ id: 'c9', name: 'Night Owls' }], error: null });
    mockSupabase.__mocks.membersInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });

    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let response: { error: string | null } | undefined;
    await require('@testing-library/react-native').act(async () => {
      response = await result.current.joinCircle('NIGHT9');
    });

    expect(response?.error).toMatch(/already a member/i);
  });
});

describe('membersFor / loadMembers', () => {
  it('merges member roster with today\'s status, defaulting missing status to not-done/streak 0', async () => {
    mockSupabase.__mocks.membersSelect.mockResolvedValue({
      data: [
        { user_id: 'user-1', display_name: 'Ada' },
        { user_id: 'user-2', display_name: 'Bo' },
      ],
      error: null,
    });
    mockSupabase.__mocks.statusSelect.mockResolvedValue({
      data: [{ user_id: 'user-1', must_do_done: true, streak: 4 }],
      error: null,
    });

    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await require('@testing-library/react-native').act(async () => {
      await result.current.loadMembers('c1');
    });

    const members = result.current.membersFor('c1');
    expect(members).toHaveLength(2);
    expect(members.find(m => m.user_id === 'user-1')).toMatchObject({ must_do_done: true, streak: 4 });
    expect(members.find(m => m.user_id === 'user-2')).toMatchObject({ must_do_done: false, streak: 0 });
  });

  it('returns an empty array for a circle with no loaded members', async () => {
    const { result } = renderHook(() => useCircles(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.membersFor('unknown')).toEqual([]);
  });
});
