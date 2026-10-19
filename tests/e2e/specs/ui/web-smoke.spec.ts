// UI smoke of the desk website on chromium, firefox and webkit.
// The untagged tests only need the website (E2E_WEB_URL, e.g. http://localhost:3100 for `next start`);
// the @stack ones need Keycloak too.
import { loginViaUi } from '../../lib/auth';
import { CLIENT_ID, KEYCLOAK_URL, PERSONAS, REALM, REDIRECT_URI, WEB_URL } from '../../lib/env';
import { expect, requireStack, requireUrl, test } from '../../lib/fixtures';
import type { Page } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';

/** The hosted login page for the web client. The realm requires PKCE (S256), like the real app sends. */
function loginUrl(state: string): string {
  const challenge = createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url');
  const url = new URL(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth`);
  url.search = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'openid', state,
    code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

async function hydrated(page: Page) {
  // ScreenShell gives wired elements role=button once React has hydrated; before that clicks do nothing.
  await expect(page.locator('.web-screen [data-lk][role]').first()).toBeAttached({ timeout: 30_000 });
}

test.describe('Web · desk faces', () => {
  requireUrl(WEB_URL, 'desk website');
  // The design preview (static prototype, sessionStorage "lodestar.design") needs no sign-in or API.
  // The signed-in, live screens are covered by web-live.spec.ts (@stack).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('lodestar.design', '1'));
  });

  test('the start page offers every role', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Waypoint Lodestar' })).toBeVisible();
    for (const [role, href] of [['Store manager', '/store/sm-26-sign-in'], ['Dispatcher', '/plan/dsp-06-sign-in'], ['Loader', '/field/s/ld-06-sign-in'], ['Admin', '/admin/adm-01-sign-in']]) {
      await expect(page.getByRole('link', { name: new RegExp(`^${role}:`) })).toHaveAttribute('href', href);
    }
    // Lodestar Run is the driver's Android app: its card has no way into the browser
    await expect(page.getByRole('link', { name: /^Driver:/ })).toHaveCount(0);
    await expect(page.locator('[data-role="run"]')).toContainText('Android app');
  });

  test('/screens lists the three faces and their screens', async ({ page }) => {
    await page.goto('/screens');
    await expect(page.getByRole('heading', { level: 1, name: 'Waypoint Lodestar' })).toBeVisible();
    for (const face of ['Lodestar Store', 'Lodestar Plan', 'Lodestar Admin']) {
      await expect(page.getByRole('link', { name: new RegExp(`${face}.*Open`) })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: /DSP-01\s*Cutoff queue/ })).toHaveAttribute('href', '/plan/dsp-01-cutoff-queue');
  });

  test('screens hydrate without page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
    for (const path of ['/', '/store/sm-01-place-order', '/plan/dsp-02-plan-board', '/plan/dsp-b1-re-plan-diff', '/admin/adm-02-overview']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
  });

  for (const [face, signIn] of [['store', '/store/sm-26-sign-in'], ['plan', '/plan/dsp-06-sign-in'], ['admin', '/admin/adm-01-sign-in']]) {
    test(`/${face} opens at its sign-in screen`, async ({ page }) => {
      await page.goto(`/${face}`);
      await expect(page).toHaveURL(new RegExp(`${signIn}$`));
      await expect(page.locator('.web-screen')).toBeVisible();
    });
  }

  test('happy path: a store order reaches the cutoff queue, then the agent draft', async ({ page }) => {
    await page.goto('/store/sm-01-place-order');
    await hydrated(page);
    await page.locator('[data-lk="L0"]').click();
    await expect(page).toHaveURL(/\/plan\/dsp-01-cutoff-queue$/);
    await hydrated(page);
    await page.locator('[data-lk="L1"]').click();
    await expect(page).toHaveURL(/\/plan\/dsp-22-planning-agent-drafting$/);
    await expect(page).toHaveURL(/\/plan\/dsp-02-plan-board$/, { timeout: 10_000 }); // auto-advance
  });

  test('keyboard: Enter on a wired element navigates', async ({ page }) => {
    await page.goto('/plan/dsp-02-plan-board');
    await hydrated(page);
    const review = page.locator('[data-lk="L3"]');
    await review.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/plan\/dsp-03-deferral-decision$/);
  });

  test('phone-only continuation shows the cross-device notice', async ({ page }) => {
    await page.goto('/plan/dsp-12-approve-and-go-live');
    await hydrated(page);
    await page.locator('[data-lk="L5"]').click();
    await expect(page.getByRole('status')).toContainText('Continues in Lodestar Dock on the phone');
    await expect(page).toHaveURL(/\/plan\/dsp-12-approve-and-go-live$/);
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('dead zone: blackout view to provisional deferral', async ({ page }) => {
    await page.goto('/plan/dsp-a1-blackout-view');
    await hydrated(page);
    await expect(page.getByText('Predicted, not live')).toBeVisible();
    await page.locator('[data-lk="L25"]').click();
    await expect(page).toHaveURL(/\/plan\/dsp-a1b-provisional-deferral$/);
  });
});

test.describe('Web · sign-in through Keycloak', { tag: '@stack' }, () => {
  requireStack();

  test('the dispatcher signs in on the hosted login page and is sent back with a code', async ({ page }) => {
    // Keycloak sends the browser back to the app with ?code=…&state=… (a redirect, so read the final URL)
    await page.goto(loginUrl('e2e'));
    await loginViaUi(page, 'dispatcher');
    await page.waitForURL(u => u.href.startsWith(REDIRECT_URI) && u.searchParams.has('code'), { timeout: 30_000 });
    const returned = new URL(page.url());
    expect(returned.searchParams.get('code')).toBeTruthy();
    expect(returned.searchParams.get('state')).toBe('e2e');
  });

  test('a wrong password stays on the login page with an error', async ({ page }) => {
    // the loader persona: a deliberate failed login must not count against the dispatcher the API tests use
    await page.goto(loginUrl('e2e-wrong'));
    await page.locator('#username').fill(PERSONAS.loader.username);
    await page.locator('#password').fill('definitely-wrong');
    await page.locator('#kc-login').click();
    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/realms\//);
  });
});
