import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DateTimePicker from '../components/DateTimePicker.web';

describe('DateTimePicker (web)', () => {
  it('renders a native date input and reports the picked day as a local date', () => {
    const onChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <DateTimePicker testID="due" value={new Date(2026, 8, 23)} mode="date" minimumDate={new Date(2026, 8, 23)} onChange={onChange} />,
    );
    const input = UNSAFE_getByType('input' as any);
    expect(input.props.type).toBe('date');
    expect(input.props.value).toBe('2026-09-23');
    expect(input.props.min).toBe('2026-09-23');

    fireEvent(input, 'change', { target: { value: '2026-10-05' } });
    const picked: Date = onChange.mock.calls[0][1];
    expect([picked.getFullYear(), picked.getMonth(), picked.getDate()]).toEqual([2026, 9, 5]);
  });

  it('renders a time input and keeps the day while changing hours and minutes', () => {
    const onChange = jest.fn();
    const { UNSAFE_getByType } = render(
      <DateTimePicker testID="t" value={new Date(2026, 8, 23, 8, 5)} mode="time" onChange={onChange} />,
    );
    const input = UNSAFE_getByType('input' as any);
    expect(input.props.type).toBe('time');
    expect(input.props.value).toBe('08:05');

    fireEvent(input, 'change', { target: { value: '21:30' } });
    const picked: Date = onChange.mock.calls[0][1];
    expect([picked.getDate(), picked.getHours(), picked.getMinutes()]).toEqual([23, 21, 30]);
  });

  it('ignores a cleared input', () => {
    const onChange = jest.fn();
    const { UNSAFE_getByType } = render(<DateTimePicker testID="d" value={new Date()} mode="date" onChange={onChange} />);
    fireEvent(UNSAFE_getByType('input' as any), 'change', { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
