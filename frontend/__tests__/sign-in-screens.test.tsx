/**
 * The designed desk sign-in screens post straight to Keycloak's token endpoint (direct grant):
 * SM-26 phone + SMS code, DSP-06 → DSP-07 email + password + code, ADM-01 email + password + authenticator code.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import StoreSignIn from '@/live/sm-26-sign-in';
import PlanSignIn from '@/live/dsp-06-sign-in';
import PlanTwoStep from '@/live/dsp-07-2-step-verification';
import AdminSignIn from '@/live/adm-01-sign-in';
import { directGrant, pendingPassword, stepFrom } from '@/lib/auth/direct';
import { signInPath } from '@/lib/auth/session';
import { page, renderLive } from './helpers/live';

const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/' }));

const TOKEN_URL = 'http://localhost/auth/realms/lodestar/protocol/openid-connect/token';
const TOKENS = { access_token: 'a.b.c', refresh_token: 'r', id_token: 'i.d.t', expires_in: 300, token_type: 'Bearer' };

type Answer = { status: number; body: Record<string, unknown> };
let answers: Answer[];
let posted: URLSearchParams[];

function json(a: Answer) {
  return { ok: a.status < 300, status: a.status, json: async () => a.body } as Response;
}

beforeEach(() => {
  answers = [];
  posted = [];
  router.push.mockReset();
  router.replace.mockReset();
  pendingPassword.clear();
  window.localStorage.clear();
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toBe(TOKEN_URL);
    posted.push(new URLSearchParams(String(init?.body)));
    return json(answers.shift() ?? { status: 500, body: {} });
  }) as unknown as typeof fetch;
});

function signedOut(ui: React.ReactElement) {
  const view = renderLive(ui, { session: null, handler: () => page([]) });
  view.auth.acceptTokens = jest.fn(async (_t, back) => back ?? '/');
  view.auth.loginSso = jest.fn(async () => undefined);
  return view;
}

describe('direct grant client', () => {
  it('posts the password grant of the public client with the screen fields', async () => {
    answers.push({ status: 200, body: TOKENS });
    const r = await directGrant({ authority: 'http://localhost/auth/realms/lodestar', clientId: 'lodestar-web' }, { phone: '+94771234567', code: '123456', empty: '' });
    expect(r.ok).toBe(true);
    expect(Object.fromEntries(posted[0])).toEqual({ grant_type: 'password', client_id: 'lodestar-web', scope: 'openid profile email', phone: '+94771234567', code: '123456' });
  });

  it('maps a code step and keeps refusals generic', () => {
    expect(stepFrom(401, { error: 'code_sent', error_description: 'We sent a 6-digit code by SMS.', method: 'sms', phone_hint: '45 67', resend_in: 30, demo_code: '123456' }))
      .toMatchObject({ error: 'code_sent', method: 'sms', phoneHint: '45 67', resendIn: 30, demoCode: '123456' });
    expect(stepFrom(401, { error: 'invalid_grant', error_description: 'Invalid user credentials' }).description).toBe('Those details did not work. Check them and try again.');
    expect(stepFrom(400, { error: 'unauthorized_client' }).description).toMatch(/not switched on/);
  });

  it('sends anonymous users to the sign-in screen of the face they wanted', () => {
    expect(signInPath('/plan/dsp-02-plan-board')).toBe('/plan/dsp-06-sign-in?returnTo=%2Fplan%2Fdsp-02-plan-board');
    expect(signInPath('/store')).toBe('/store/sm-26-sign-in');
    expect(signInPath('/admin/adm-03-people-and-roles')).toMatch(/^\/admin\/adm-01-sign-in\?returnTo=/);
    expect(signInPath('/elsewhere')).toBe('/');
  });
});

describe('SM-26 Sign in · phone + SMS code', () => {
  it('sends a code, shows the demo code, and signs in with it', async () => {
    const view = signedOut(<StoreSignIn />);
    fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '77 456 7890' } });
    answers.push({ status: 401, body: { error: 'code_sent', error_description: 'We sent a 6-digit code by SMS.', method: 'sms', phone_hint: '78 90', resend_in: 30, demo_code: '482913' } });
    fireEvent.click(screen.getByTestId('sign-in'));
    expect(await screen.findByTestId('demo-code')).toHaveTextContent('Demo: your code is 482913');
    expect(posted[0].get('phone')).toBe('77 456 7890');
    expect(screen.getByText(/Resend in 0:(2|3)\d/)).toBeInTheDocument();

    answers.push({ status: 200, body: TOKENS });
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: '482913' } });
    await waitFor(() => expect(view.auth.acceptTokens).toHaveBeenCalledWith(TOKENS, '/store'));
    expect(posted[1].get('code')).toBe('482913');
    expect(router.replace).toHaveBeenCalledWith('/store');
  });

  it('shows the generic refusal for a wrong code and clears the boxes', async () => {
    signedOut(<StoreSignIn />);
    fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '0774567890' } });
    answers.push({ status: 401, body: { error: 'code_sent', method: 'sms', resend_in: 30 } });
    fireEvent.click(screen.getByTestId('sign-in'));
    await screen.findByText(/Resend in/);
    answers.push({ status: 401, body: { error: 'invalid_grant', error_description: "That code isn't right. Check the SMS and try again.", attempts_left: 4 } });
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: '111111' } });
    expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't right");
    expect(screen.getByTestId('code-input')).toHaveValue('');
  });

  it('asks for the number before sending anything', async () => {
    signedOut(<StoreSignIn />);
    fireEvent.click(screen.getByTestId('sign-in'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your mobile number.');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('DSP-06 → DSP-07 · work email, password, then the code', () => {
  it('a correct password moves to DSP-07, which signs in with the SMS code', async () => {
    signedOut(<PlanSignIn />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'nilanthi@waypoint.lk' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'secret' } });
    answers.push({ status: 401, body: { error: 'code_sent', method: 'sms', phone_hint: '45 67', expires_in: 300, resend_in: 30, demo_code: '135790' } });
    fireEvent.click(screen.getByTestId('sign-in'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/plan/dsp-07-2-step-verification'));
    expect(Object.fromEntries(posted[0])).toMatchObject({ username: 'nilanthi@waypoint.lk', password: 'secret' });

    const view = signedOut(<PlanTwoStep />);
    expect(screen.getByText('Enter the 6-digit code')).toBeInTheDocument();
    expect(screen.getByTestId('code-hint')).toHaveTextContent('We sent it to your on-call phone ending 45 67. It expires in');
    expect(screen.getByText('Step 2 of 2 · nilanthi@waypoint.lk')).toBeInTheDocument();
    answers.push({ status: 200, body: TOKENS });
    fireEvent.change(screen.getByTestId('code-input'), { target: { value: '135790' } });
    await waitFor(() => expect(view.auth.acceptTokens).toHaveBeenCalled());
    expect(Object.fromEntries(posted[1])).toMatchObject({ username: 'nilanthi@waypoint.lk', password: 'secret', code: '135790' });
    expect(pendingPassword.get()).toBeNull();
  });

  it('a wrong password stays on DSP-06 with one generic message', async () => {
    signedOut(<PlanSignIn />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'nobody@waypoint.lk' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'x' } });
    answers.push({ status: 401, body: { error: 'invalid_grant', error_description: 'Wrong email or password.' } });
    fireEvent.click(screen.getByTestId('sign-in'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('the password has a placeholder and an eye that shows and hides it', () => {
    signedOut(<PlanSignIn />);
    const pw = screen.getByTestId('password-input');
    expect(pw).toHaveAttribute('type', 'password');
    expect(pw).toHaveAttribute('placeholder', 'Enter your password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(pw).toHaveAttribute('type', 'password');
  });

  it('keeps Waypoint single sign-on as the secondary path', () => {
    const view = signedOut(<PlanSignIn />);
    fireEvent.click(screen.getByTestId('sso'));
    expect(view.auth.loginSso).toHaveBeenCalledWith('/plan');
  });

  it('DSP-07 without a pending step 1 goes back to DSP-06', async () => {
    signedOut(<PlanTwoStep />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/plan/dsp-06-sign-in'));
  });
});

describe('ADM-01 · email + password, then the authenticator code in place', () => {
  it('asks for the authenticator code and can switch to SMS', async () => {
    const view = signedOut(<AdminSignIn />);
    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'admin@waypoint.lk' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'pw' } });
    answers.push({ status: 401, body: { error: 'otp_required', method: 'totp', sms_available: true, phone_hint: '00 01' } });
    fireEvent.click(screen.getByTestId('sign-in'));
    expect(await screen.findByTestId('two-step')).toBeInTheDocument();
    expect(screen.getByTestId('code-hint')).toHaveTextContent('authenticator app');

    answers.push({ status: 401, body: { error: 'code_sent', method: 'sms', phone_hint: '00 01', expires_in: 300, resend_in: 30 } });
    fireEvent.click(screen.getByTestId('send-sms'));
    await screen.findByText(/on-call phone ending/);
    expect(posted[1].get('send')).toBe('sms');

    answers.push({ status: 200, body: TOKENS });
    await act(async () => {
      fireEvent.change(screen.getByTestId('code-input'), { target: { value: '246810' } });
    });
    await waitFor(() => expect(view.auth.acceptTokens).toHaveBeenCalledWith(TOKENS, '/admin'));
    expect(posted[2].get('code')).toBe('246810');
  });
});
