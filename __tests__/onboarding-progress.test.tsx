import React from 'react';
import { render } from '@testing-library/react-native';
import { Progress } from '../app/(onboarding)/_progress';

describe('<Progress /> (onboarding step indicator)', () => {
  it('renders the current step out of the total', () => {
    const { getByText } = render(<Progress step={2} of={5} />);
    expect(getByText('Step 2 of 5')).toBeTruthy();
  });

  it('renders one segment per step', () => {
    const { UNSAFE_root } = render(<Progress step={3} of={4} />);
    // The step label View + a row of `of` segment Views == 2 top-level Views,
    // with `of` children in the segment row.
    const views = UNSAFE_root.findAllByType(require('react-native').View);
    // 1 wrapper + 1 segment row + `of` segments = 2 + of
    expect(views.length).toBe(2 + 4);
  });
});
