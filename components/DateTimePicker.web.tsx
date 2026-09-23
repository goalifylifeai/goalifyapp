import React from 'react';
import { localDateISO } from '../lib/date';

type Props = {
  value: Date;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  onChange?: (event: { type: 'set' }, date?: Date) => void;
  testID?: string;
  // Native-only props (display, etc.) are accepted and ignored.
  [key: string]: unknown;
};

const pad = (n: number) => String(n).padStart(2, '0');

// Web stand-in for @react-native-community/datetimepicker: the browser's own
// date/time input, with the same value/onChange(event, date) contract.
export default function DateTimePicker({ value, mode = 'date', minimumDate, onChange, testID }: Props) {
  const isTime = mode === 'time';
  const inputValue = isTime ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : localDateISO(value);

  const handleChange = (e: { target: { value: string } }) => {
    const v = e.target.value;
    if (!v) return;
    let next: Date;
    if (isTime) {
      const [h, m] = v.split(':').map(Number);
      next = new Date(value);
      next.setHours(h, m, 0, 0);
    } else {
      next = new Date(`${v}T00:00:00`);
    }
    onChange?.({ type: 'set' }, next);
  };

  return React.createElement('input', {
    type: isTime ? 'time' : 'date',
    value: inputValue,
    min: !isTime && minimumDate ? localDateISO(minimumDate) : undefined,
    onChange: handleChange,
    autoFocus: true,
    'data-testid': testID,
    style: { fontSize: 15, padding: 8, marginBottom: 12, borderRadius: 8, border: '1px solid #ccc' },
  });
}
