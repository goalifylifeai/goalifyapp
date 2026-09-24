import { imagesDisabledFor } from '../supabase/functions/_shared/vision-access';

const QA = '0a1b2c3d-1111-4222-8333-444455556666';

describe('imagesDisabledFor', () => {
  it('matches a listed user id, ignoring spaces and case', () => {
    expect(imagesDisabledFor(QA, ` other-id , ${QA.toUpperCase()} `)).toBe(true);
  });
  it('is false for anyone else, or when the setting is unset or empty', () => {
    expect(imagesDisabledFor('someone-else', QA)).toBe(false);
    expect(imagesDisabledFor(QA, undefined)).toBe(false);
    expect(imagesDisabledFor(QA, '')).toBe(false);
  });
});
