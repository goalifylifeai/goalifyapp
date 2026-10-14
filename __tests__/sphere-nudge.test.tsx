// Empty-sphere nudge: decision logic in constants/data.ts and the home
// screen component that renders it.
jest.mock('../lib/analytics', () => ({ track: jest.fn() }));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from '../lib/analytics';
import { snoozeSphereNudge } from '../lib/sphere-nudge-snooze';
import { sphereNudge, computeSphereData, SPHERE_EMPTY_NUDGES, SPHERE_LIST } from '../constants/data';
import { SphereNudge } from '../components/SphereNudge';
import type { Goal } from '../store/reducer';

const goal = (id: string, sphere: Goal['sphere']): Goal =>
  ({ id, sphere, title: id, due: '2026-12-01', progress: 0, sub: [] } as Goal);

describe('sphereNudge()', () => {
  it('is silent when no sphere has a goal (overview card owns that state)', () => {
    expect(sphereNudge(computeSphereData([]))).toEqual({ kind: 'none' });
  });

  it('is silent when every sphere has a goal', () => {
    const goals = SPHERE_LIST.map(s => goal(`g-${s}`, s));
    expect(sphereNudge(computeSphereData(goals))).toEqual({ kind: 'none' });
  });

  it('lists all empty spheres, in SPHERE_LIST order, when more than one is left', () => {
    expect(sphereNudge(computeSphereData([goal('g1', 'finance')]))).toEqual({
      kind: 'many', spheres: ['health', 'career', 'relationships'],
    });
  });

  it('names the sphere when exactly one is left', () => {
    const goals = [goal('g1', 'finance'), goal('g2', 'career'), goal('g3', 'relationships')];
    expect(sphereNudge(computeSphereData(goals))).toEqual({ kind: 'single', sphere: 'health' });
  });

  it('has copy for every sphere', () => {
    for (const s of SPHERE_LIST) expect(SPHERE_EMPTY_NUDGES[s].length).toBeGreaterThan(0);
  });
});

describe('<SphereNudge />', () => {
  const oneStarted = () => computeSphereData([goal('g1', 'finance')]);
  const threeStarted = () =>
    computeSphereData([goal('g1', 'finance'), goal('g2', 'career'), goal('g3', 'relationships')]);

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('renders nothing when there is nothing to nudge', async () => {
    const { queryByTestId } = render(
      <SphereNudge sphereData={computeSphereData([])} onAddGoal={jest.fn()} />,
    );
    await act(async () => {});
    expect(queryByTestId('sphere-nudge')).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('offers one chip per empty sphere and reports the tapped one', async () => {
    const onAddGoal = jest.fn();
    const { getByText, getByTestId, queryByTestId, findByTestId } = render(
      <SphereNudge sphereData={oneStarted()} onAddGoal={onAddGoal} />,
    );
    await findByTestId('sphere-nudge');
    expect(getByText('Would you like to add goals for your other spheres?')).toBeTruthy();
    expect(queryByTestId('sphere-nudge-finance')).toBeNull();
    expect(track).toHaveBeenCalledWith('sphere_nudge_viewed', { variant: 'many', remaining_count: 3 });

    fireEvent.press(getByTestId('sphere-nudge-career'));
    expect(onAddGoal).toHaveBeenCalledWith('career');
    expect(track).toHaveBeenCalledWith('sphere_nudge_tapped', { sphere: 'career', remaining_count: 3 });
  });

  it('asks specifically for the last empty sphere', async () => {
    const onAddGoal = jest.fn();
    const { getByText, getByTestId, findByTestId } = render(
      <SphereNudge sphereData={threeStarted()} onAddGoal={onAddGoal} />,
    );
    await findByTestId('sphere-nudge');
    expect(getByText(SPHERE_EMPTY_NUDGES.health)).toBeTruthy();
    expect(track).toHaveBeenCalledWith('sphere_nudge_viewed', { variant: 'single', remaining_count: 1 });
    fireEvent.press(getByTestId('sphere-nudge-health'));
    expect(onAddGoal).toHaveBeenCalledWith('health');
    expect(track).toHaveBeenCalledWith('sphere_nudge_tapped', { sphere: 'health', remaining_count: 1 });
  });

  it('"Not now" hides it immediately and persists a 7-day snooze', async () => {
    const { getByTestId, queryByTestId, findByTestId } = render(
      <SphereNudge sphereData={oneStarted()} onAddGoal={jest.fn()} />,
    );
    await findByTestId('sphere-nudge');
    await act(async () => { fireEvent.press(getByTestId('sphere-nudge-not-now')); });
    expect(queryByTestId('sphere-nudge')).toBeNull();
    expect(track).toHaveBeenCalledWith('sphere_nudge_snoozed', { remaining_count: 3 });
    const stored = Number(await AsyncStorage.getItem('@goalify/sphere_nudge_snoozed_until'));
    expect(stored).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);
  });

  it('stays hidden while a snooze is active and fires no view event', async () => {
    await snoozeSphereNudge();
    const { queryByTestId } = render(
      <SphereNudge sphereData={oneStarted()} onAddGoal={jest.fn()} />,
    );
    await act(async () => {});
    expect(queryByTestId('sphere-nudge')).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('comes back once the snooze has expired', async () => {
    await snoozeSphereNudge(Date.now() - 8 * 86_400_000);
    const { findByTestId } = render(
      <SphereNudge sphereData={oneStarted()} onAddGoal={jest.fn()} />,
    );
    await waitFor(() => expect(findByTestId('sphere-nudge')).resolves.toBeTruthy());
  });
});
