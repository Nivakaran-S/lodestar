'use client';
// What the designed desk sign-in screens share (SM-26, DSP-06/07, ADM-01): posting a step to the token endpoint,
// storing the tokens and leaving for the user's face, countdowns, and the 6-digit code boxes of the designs
// (`dx-otp` / `sx-otp`) made typeable by a transparent input laid over them.
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { directGrant, digits, type DirectResult } from '@/lib/auth/direct';
import { landingFor, type Face } from '@/lib/auth/session';
import { runtimeConfig } from '@/lib/config';
import { Ic } from './icons';

/** ?returnTo= of the sign-in screen (read once in the browser). */
export function useReturnTo(): string | null {
  const [v] = useState(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('returnTo')));
  return v;
}

export function useDirectSignIn(face: Face) {
  const auth = useAuth();
  const router = useRouter();
  const returnTo = useReturnTo();
  const [busy, setBusy] = useState(false);
  const signedIn = auth.status === 'authenticated' && auth.session ? auth.session : null;

  /** Posts one step. Tokens: stored and the user leaves for their face (or the deep link they came from). */
  const submit = useCallback(async (params: Record<string, string | undefined>): Promise<DirectResult> => {
    setBusy(true);
    try {
      const r = await directGrant(runtimeConfig(), params);
      if (r.ok) {
        const to = auth.acceptTokens ? await auth.acceptTokens(r.tokens, returnTo ?? `/${face}`) : `/${face}`;
        router.replace(to);
      }
      return r;
    } finally {
      setBusy(false);
    }
  }, [auth, face, returnTo, router]);

  /** The screens' "single sign-on" button: Keycloak's redirect flow (Waypoint SSO / identity brokering). */
  const sso = useCallback(() => {
    const go = auth.loginSso ?? auth.login;
    void go(returnTo ?? `/${face}`);
  }, [auth, face, returnTo]);

  const continueSignedIn = useCallback(() => {
    if (signedIn) router.replace(landingFor(signedIn.roles));
  }, [router, signedIn]);

  return { submit, busy, sso, returnTo, signedIn, continueSignedIn, loading: auth.status === 'loading' };
}

/** Seconds left until `until` (epoch ms), ticking every second; 0 when passed or unset. */
export function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

/**
 * The design's code boxes with a transparent input over them: typing, pasting and the phone's SMS autofill
 * (autocomplete="one-time-code") fill the boxes; Enter submits.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  render,
  testId = 'code-input',
  label = '6-digit code',
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  /** Draws the design's boxes for the current value and the focused index. */
  render: (chars: string[], focus: number) => ReactNode;
  testId?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  const overlay: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 0, cursor: 'text', fontSize: '16px' };
  return (
    <div style={{ position: 'relative' }} onClick={() => ref.current?.focus()}>
      {render(chars, focused ? Math.min(value.length, length - 1) : -1)}
      <input
        ref={ref}
        data-testid={testId}
        aria-label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        style={overlay}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => {
          const v = digits(e.target.value, length);
          onChange(v);
          if (v.length === length) onComplete?.(v);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.length === length) onComplete?.(value);
        }}
      />
    </div>
  );
}

/** The refusal or hint line under a sign-in form. */
export function SignInMessage({ text, tone = 'error', testId = 'sign-in-error' }: { text: string | null | undefined; tone?: 'error' | 'info'; testId?: string }) {
  if (!text) return null;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} style={{ fontSize: '14px', lineHeight: 1.45, fontWeight: 600, color: tone === 'error' ? 'var(--danger)' : 'var(--text-2)' }}>
      {text}
    </div>
  );
}

/** Demo stacks (DEMO_SHOW_CODES): the code the SMS carries, shown the way the SMS would. */
export function DemoCode({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <div data-testid="demo-code" data-code={code} style={{ fontSize: '13px', color: 'var(--text-3)' }}>
      {'Demo: your code is '}<b style={{ color: 'var(--text)', letterSpacing: '0.08em' }}>{code}</b>
    </div>
  );
}

/** A plain input that takes the design's field look (the field box draws border, padding and font). */
export const bareInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: 0,
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  padding: 0,
  height: '100%',
};

/** The password box of the desk sign-ins, with a show/hide eye so a long password can be checked before sending. */
export function PasswordInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input id={id} data-testid="password-input" type={shown ? 'text' : 'password'} autoComplete="current-password"
        placeholder="Enter your password" style={bareInput} value={value} onChange={e => onChange(e.target.value)} />
      <button type="button" data-testid="password-toggle" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}
        onClick={() => setShown(v => !v)}
        style={{ border: 0, background: 'transparent', padding: '4px', margin: '-4px', cursor: 'pointer', color: 'var(--text-3)', display: 'inline-flex' }}>
        <Ic n={shown ? 'eye-off' : 'eye'} />
      </button>
    </>
  );
}

/** Remembers a sign-in field on this computer for 30 days ("Remember this counter PC", "Trust this office computer"). */
export const remembered = {
  get(key: string): string | null {
    try {
      const raw = window.localStorage.getItem(`lodestar.remember.${key}`);
      const v = raw ? (JSON.parse(raw) as { value: string; until: number }) : null;
      return v && v.until > Date.now() ? v.value : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value) window.localStorage.setItem(`lodestar.remember.${key}`, JSON.stringify({ value, until: Date.now() + 30 * 86_400_000 }));
      else window.localStorage.removeItem(`lodestar.remember.${key}`);
    } catch {
      // storage blocked: nothing remembered
    }
  },
};
