// End-to-end checks for the recent sign-in, password-reset, habit-delete and
// earned-XP work, on web against the real backend.
//
// Runs on the QA account (E2E_TEST_EMAIL), which is also the owner's real
// account. Everything created here is prefixed "QA " and deleted again; no
// other data is edited or deleted.

import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

async function openSignIn(page: Page) {
  await page.goto('/');
  await page.getByText('I already have an account').click();
  await expect(page.getByTestId('email-input')).toBeVisible();
}

// Signed in = the tabs are up. The analytics prompt covers them once per
// fresh browser; decline it when it shows.
async function waitForApp(page: Page) {
  const goals = page.getByText('Goals', { exact: true }).filter({ visible: true });
  const deny = page.getByTestId('consent-deny');
  await expect(goals.or(deny).first()).toBeVisible({ timeout: 15_000 });
  if (await deny.isVisible({ timeout: 3_000 }).catch(() => false)) await deny.click();
  await expect(goals).toBeVisible({ timeout: 10_000 });
}

async function signIn(page: Page) {
  await openSignIn(page);
  await page.getByTestId('email-input').fill(EMAIL!);
  await page.getByTestId('password-input').fill(PASSWORD!);
  await page.getByTestId('sign-in-button').click();
  await waitForApp(page);
}

// The Today tab lists habits too (and stays mounted), so find a habit by its
// Habits-tab check-off control rather than by its text.
const habitRow = (page: Page, label: string) =>
  page.getByRole('checkbox', { name: `${label} done today` });

const xpOf = async (page: Page) =>
  Number((await page.getByTestId('header-xp').filter({ visible: true }).first().innerText()).replace(/[^\d]/g, ''));

test.describe('recent fixes', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — see .env.example');

  test('sign-in: wrong password errors; fields lock while busy; Enter signs in without hanging', async ({ page }) => {
    await openSignIn(page);
    await page.getByTestId('email-input').fill(EMAIL!);
    await page.getByTestId('password-input').fill('QA-definitely-wrong-password');
    await page.getByTestId('password-input').press('Enter');
    await expect(page.getByText('Wrong email or password.')).toBeVisible({ timeout: 10_000 });

    // Hold the token request so the busy state is observable.
    await page.route('**/auth/v1/token**', async route => {
      await new Promise(r => setTimeout(r, 1_500));
      await route.continue();
    });
    await page.getByTestId('password-input').fill(PASSWORD!);
    await page.getByTestId('password-input').press('Enter');
    await expect(page.getByText('Signing in…')).toBeVisible();
    await expect(page.getByTestId('email-input')).not.toBeEditable();
    await expect(page.getByTestId('password-input')).not.toBeEditable();

    // The deadlock left this on "Signing in…" forever.
    await waitForApp(page);
    await page.unroute('**/auth/v1/token**');
  });

  test('header shows earned XP, not a hard-coded 0', async ({ page }) => {
    await signIn(page);
    await expect(page.getByTestId('header-xp').filter({ visible: true }).first()).toHaveText(/^[\d,]+ XP$/);
    await expect.poll(() => xpOf(page), { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test('habit: create, check (earns XP), uncheck (revokes), delete with confirm, stays deleted', async ({ page }) => {
    const label = `QA habit ${Date.now()}`;
    await signIn(page);
    await page.getByText('Habits', { exact: true }).click();
    await expect(page.getByText('Habits.')).toBeVisible();

    // Clear QA habits a previous failed run may have left (QA-prefixed only),
    // once the server copy of the list has had time to load.
    await page.waitForTimeout(3_000);
    for (const del of await page.getByLabel(/^Delete QA habit /).all()) {
      const name = (await del.getAttribute('aria-label'))!.replace(/^Delete /, '');
      await del.click();
      await page.getByLabel(`Confirm delete ${name}`).click();
    }

    await page.getByText('+ New').click();
    await page.getByPlaceholder('Habit name').fill(label);
    await page.getByText('Save habit').click();
    await expect(habitRow(page, label)).toBeVisible();

    await expect.poll(() => xpOf(page), { timeout: 10_000 }).toBeGreaterThan(0);
    const before = await xpOf(page);
    const box = habitRow(page, label);
    await box.click();
    await expect(box).toBeChecked();
    await expect.poll(() => xpOf(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(before + 5);

    // Reload: still checked only if the server stored the check-off (it
    // never did before: every habit_logs write was rejected). The XP then
    // comes from the server ledger, not the app's local estimate.
    await page.waitForTimeout(2_000);
    await page.reload();
    await waitForApp(page);
    await page.getByText('Habits', { exact: true }).click();
    await expect(habitRow(page, label)).toBeChecked({ timeout: 15_000 });
    await expect.poll(() => xpOf(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(before + 5);
    const checked = await xpOf(page);
    await box.click();
    await expect(box).not.toBeChecked();
    await expect.poll(() => xpOf(page), { timeout: 15_000 }).toBe(checked - 5);

    // Delete asks first; Cancel keeps it.
    await page.getByLabel(`Delete ${label}`).click();
    await expect(page.getByText('Delete this habit and its history?')).toBeVisible();
    await page.getByText('Cancel', { exact: true }).click();
    await expect(habitRow(page, label)).toBeVisible();

    await page.getByLabel(`Delete ${label}`).click();
    await page.getByLabel(`Confirm delete ${label}`).click();
    await expect(habitRow(page, label)).toHaveCount(0);

    // Reload: the server copy must agree it's gone.
    await page.waitForTimeout(2_000);
    await page.reload();
    await page.getByText('Habits', { exact: true }).click();
    await expect(page.getByText('Habits.')).toBeVisible();
    await page.waitForTimeout(3_000);
    await expect(habitRow(page, label)).toHaveCount(0);
  });

  test('onboarding state failing to load shows a retry screen instead of a dead sign-in', async ({ page }) => {
    await page.route('**/rest/v1/onboarding_state**', route => route.abort());
    await openSignIn(page);
    await page.getByTestId('email-input').fill(EMAIL!);
    await page.getByTestId('password-input').fill(PASSWORD!);
    await page.getByTestId('sign-in-button').click();
    await expect(page.getByText("Couldn't load your account.")).toBeVisible({ timeout: 15_000 });

    await page.unroute('**/rest/v1/onboarding_state**');
    await page.getByTestId('onboarding-retry').click();
    await waitForApp(page);
  });

  test('expired reset link explains itself and clears the tokens from the address bar', async ({ page }) => {
    await page.goto('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByText(/That link has expired or was already used\. Request a new one below\./)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Reset password.')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('a reset link with bad tokens does not leave the user stuck on "New password"', async ({ page }) => {
    await page.goto('/reset-password#access_token=bogus&refresh_token=bogus&type=recovery');
    await expect(page.getByText(/That link has expired or was already used/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Reset password.')).toBeVisible();
    await expect(page.getByText('New password.')).toHaveCount(0);
  });

  test('expired confirm link fails fast instead of after the 6s timeout', async ({ page }) => {
    await page.goto('/confirm#error=access_denied&error_code=otp_expired');
    await expect(page.getByText("That link didn't work.")).toBeVisible({ timeout: 3_000 });
  });

  test('sign out returns to the auth landing', async ({ page }) => {
    await signIn(page);
    await page.goto('/profile');
    await page.getByText('Sign out', { exact: true }).click();
    await expect(page.getByText('I already have an account')).toBeVisible({ timeout: 10_000 });
  });
});
