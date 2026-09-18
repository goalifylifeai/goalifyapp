import { generateInviteCode } from '../lib/circles';

describe('generateInviteCode', () => {
  it('returns a 6-character uppercase alphanumeric code', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('avoids visually ambiguous characters (0/O, 1/I/L)', () => {
    const code = generateInviteCode();
    expect(code).not.toMatch(/[0O1IL]/);
  });

  it('returns different codes across calls (not deterministic)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
