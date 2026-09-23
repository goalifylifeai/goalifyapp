// Smoke/characterization test for app/(tabs)/_layout.tsx — the tab bar
// config. expo-router's <Tabs> needs a navigation container to render for
// real, so we stub Tabs/Tabs.Screen to plain views and instead assert on
// the screenOptions functions (header, tabBarBackground) and per-screen
// tabBarIcon renderers that TabLayout builds, plus the header's profile
// display logic (HeaderRight/HeaderTitle, defined in the same file).

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Tabs = jest.fn((props: any) => React.createElement(View, { testID: 'tabs-root' }, props.children));
  (Tabs as any).Screen = jest.fn((props: any) => React.createElement(View, { testID: `tab-screen-${props.name}` }));
  return { Tabs, router: { push: jest.fn() } };
});

jest.mock('../store/profile', () => ({
  useProfile: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 10, bottom: 20, left: 0, right: 0 }),
  };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import TabLayout from '../app/(tabs)/_layout';
import { useProfile } from '../store/profile';
import { Tabs } from 'expo-router';

describe('<TabLayout /> tab bar config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useProfile as jest.Mock).mockReturnValue({ profile: { display_name: 'Grace' } });
  });

  it('renders without crashing and registers all five tab screens', () => {
    const { getByTestId } = render(<TabLayout />);
    expect(getByTestId('tabs-root')).toBeTruthy();
    for (const name of ['index', 'goals', 'habits', 'journal', 'coach']) {
      expect(getByTestId(`tab-screen-${name}`)).toBeTruthy();
    }
  });

  it('renders the header with the profile initial and app title', () => {
    render(<TabLayout />);
    const tabsCall = (Tabs as unknown as jest.Mock).mock.calls[0][0];
    const { getByText } = render(tabsCall.screenOptions.header());
    expect(getByText('goalify')).toBeTruthy();
    expect(getByText('G')).toBeTruthy(); // first letter of display_name, uppercased
  });

  it('shows "?" as the header initial when there is no profile display_name', () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: null });
    render(<TabLayout />);
    const tabsCall = (Tabs as unknown as jest.Mock).mock.calls[0][0];
    const { getAllByText } = render(tabsCall.screenOptions.header());
    // Two "?" render: the help/tour button and the avatar initial fallback.
    expect(getAllByText('?').length).toBe(2);
  });

  it('builds tabBarIcon renderers for every screen without throwing', () => {
    render(<TabLayout />);
    const screenCalls = (Tabs.Screen as jest.Mock).mock.calls;
    expect(screenCalls.length).toBe(5);
    for (const [props] of screenCalls) {
      expect(() => render(props.options.tabBarIcon({ focused: true }))).not.toThrow();
      expect(() => render(props.options.tabBarIcon({ focused: false }))).not.toThrow();
    }
  });
});
