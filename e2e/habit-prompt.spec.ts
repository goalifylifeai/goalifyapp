import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

async function ensureSignedIn(page: Page) {
  await page.goto('/');

  const emailInput = page.getByTestId('email-input');
  const signInLink = page.getByText('I already have an account');

  if (await signInLink.isVisible().catch(() => false)) {
    await signInLink.click();
  }
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill(EMAIL!);
    await page.getByTestId('password-input').fill(PASSWORD!);
    await page.getByTestId('sign-in-button').click();
  }

  await expect(page.getByText('Goals', { exact: true })).toBeVisible({ timeout: 15_000 });
}

async function createGoal(page: Page, title: string) {
  await page.getByText('Goals', { exact: true }).click();
  await expect(page.getByText('Goals.')).toBeVisible();
  await page.getByTestId('new-goal-button').click();
  await page.getByTestId('goal-title-input').fill(title);
  await page.getByTestId('save-goal-button').click();
}

test.describe('habit prompt after saving a goal', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — see .env.example');

  test('shows a popup to add a daily habit, and links it to the goal', async ({ page }) => {
    const goalTitle = `E2E goal ${Date.now()}`;
    const habitLabel = `Run 20 minutes ${Date.now()}`;

    await ensureSignedIn(page);
    await createGoal(page, goalTitle);

    const habitPrompt = page.getByTestId('habit-prompt-modal');
    await expect(habitPrompt).toBeVisible();
    await expect(habitPrompt.getByText(goalTitle)).toBeVisible();

    await page.getByTestId('habit-label-input').fill(habitLabel);
    await page.getByTestId('save-habit-button').click();
    await expect(habitPrompt).toBeHidden();

    // The habit now shows on the Habits tab, linked to the goal via sphere.
    await page.getByText('Habits', { exact: true }).click();
    await expect(page.getByText(habitLabel).first()).toBeVisible();
  });

  test('skipping the popup does not create a habit', async ({ page }) => {
    const goalTitle = `E2E skip goal ${Date.now()}`;

    await ensureSignedIn(page);
    await createGoal(page, goalTitle);

    const habitPrompt = page.getByTestId('habit-prompt-modal');
    await expect(habitPrompt).toBeVisible();

    await page.getByTestId('skip-habit-button').click();
    await expect(habitPrompt).toBeHidden();

    // Goal was still saved even though the habit was skipped.
    await expect(page.getByText(goalTitle)).toBeVisible();
  });
});
