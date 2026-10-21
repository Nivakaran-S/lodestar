// Watches the session: when it ends for a reason (expired, device revoked, not registered), opens the
// design's access screen for the user's face; on any sign-out it drops the cached data of that user.
// Watches the device enrollment too: a phone that is not bound to the token yet is sent to the
// access-request screen (SM-32) and stays there until it is approved.
import { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';
import { useStore } from '@/lib/store';
import { showToast } from '@/lodestar/runtime';
import { session } from '@/model/platform';
import { clearCache } from '@/model/query';
import { enrollment } from './device-access';
import { ENROLLING } from './enrollment';
import { ACCESS_REQUEST_SCREEN, accessScreenFor, SIGN_IN, type ProblemKind } from './roles';

const RESETS: readonly ProblemKind[] = ['revoked', 'unregistered', 'denied'];
/** Sign-in screens (every face's, and the dock tablet's shared one): a stale session expiring there stays put. */
const SIGN_IN_SCREENS = new Set<string>([...Object.values(SIGN_IN), 'ld-20-shared-sign-in']);

export function AccessGuard() {
  const s = useStore(session.state);
  const e = useStore(enrollment.state);
  const seen = useRef<string | null>(null);
  const seenRequest = useRef<string | null>(null);
  const lastSub = useRef<string | null>(null);
  const path = usePathname();
  const here = path.split('/').pop() ?? '';

  useEffect(() => {
    const sub = s.claims?.sub ?? null;
    if (s.status === 'signed-out' && lastSub.current) {
      // keep the cache only when the session merely expired (the run must keep working offline)
      if (s.problem?.kind !== 'expired') void clearCache(lastSub.current);
    }
    if (s.status !== 'restoring') lastSub.current = sub;
    // signed out on purpose, or the account/phone was refused: no access request is waiting any more
    // (an approval ends the session as 'expired', and a cancelled sign-in is 'failed': both stay on SM-32)
    if (s.status === 'signed-out' && enrollment.active && (!s.problem || RESETS.includes(s.problem.kind))) enrollment.reset();

    const p = s.problem;
    if (!p || seen.current === p.at) return;
    seen.current = p.at;
    if (p.kind === 'failed') {
      showToast(p.message, 'error');
      return;
    }
    // Approving a phone ends the user's sessions: stay on the access-request screen, which asks to sign in again.
    if (p.kind === 'expired' && enrollment.active) return;
    // Someone opening a sign-in screen (a loader on a shared tablet a store manager used before) is signing in
    // anyway: a leftover session that expired must not send them to another face's "signed out" screen.
    if (p.kind === 'expired' && SIGN_IN_SCREENS.has(here)) return;
    router.replace({ pathname: '/s/[key]', params: { key: accessScreenFor(s.face, p.kind) } });
  }, [s.status, s.claims, s.problem, s.face, here]);

  useEffect(() => {
    if (!e.since || !ENROLLING.includes(e.status) || seenRequest.current === e.since) return;
    seenRequest.current = e.since;
    router.replace({ pathname: '/s/[key]', params: { key: ACCESS_REQUEST_SCREEN } });
  }, [e.since, e.status]);

  return null;
}
