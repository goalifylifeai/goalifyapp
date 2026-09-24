// Needs a PostHog key in the build (any value; requests are intercepted here):
//   POSTHOG_API_KEY=phc_e2e npx playwright test e2e/analytics-consent.spec.ts
import { test, expect, type Page, type Request } from '@playwright/test';
import { gunzipSync } from 'zlib';

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

function body(req: Request): string {
  const buf = req.postDataBuffer();
  if (!buf) return '';
  try { return gunzipSync(buf).toString('utf8'); } catch { return buf.toString('utf8'); }
}

/** Intercepts everything bound for PostHog and records the payloads. */
async function capturePostHog(page: Page): Promise<string[]> {
  const sent: string[] = [];
  await page.route(/posthog\.com/, route => {
    sent.push(body(route.request()));
    if (process.env.E2E_DEBUG) console.log('POSTHOG', route.request().url(), body(route.request()).slice(0, 600));
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  return sent;
}

async function signIn(page: Page) {
  await page.goto('/');
  const signInLink = page.getByText('I already have an account');
  if (await signInLink.isVisible().catch(() => false)) await signInLink.click();
  await page.getByTestId('email-input').fill(EMAIL!);
  await page.getByTestId('password-input').fill(PASSWORD!);
  await page.getByTestId('sign-in-button').click();
}

test.describe('analytics consent', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — see .env.example');
  test.skip(!process.env.POSTHOG_API_KEY, 'POSTHOG_API_KEY not set — analytics is off without it');

  test('sends nothing until "Allow", then sends events without personal data', async ({ page }) => {
    const sent = await capturePostHog(page);
    await signIn(page);

    await expect(page.getByTestId('consent-allow')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2_000);
    expect(sent).toHaveLength(0);

    await page.getByTestId('consent-allow').click();
    await expect(page.getByTestId('consent-allow')).toBeHidden();

    // Events go out in batches (the SDK flushes every ~10s), after its config/flags calls.
    await expect.poll(() => sent.join('\n'), { timeout: 30_000 }).toContain('analytics_consent_changed');
    const all = sent.join('\n');
    expect(all).toContain('signed_in');
    expect(all).toContain('$screen');
    expect(all).not.toContain(EMAIL!);
    expect(all).not.toContain('localhost:8091'); // before_send strips URLs
  });

  test('"No thanks" sends nothing', async ({ page }) => {
    const sent = await capturePostHog(page);
    await signIn(page);

    await expect(page.getByTestId('consent-deny')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('consent-deny').click();
    await expect(page.getByTestId('consent-deny')).toBeHidden();

    await page.getByText('Habits', { exact: true }).click();
    await page.waitForTimeout(12_000); // longer than the SDK's flush interval
    expect(sent).toHaveLength(0);
  });
});
