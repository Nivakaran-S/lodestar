// Where each role lands after sign-in, and which design screens show access problems.
import type { Claims, Role } from './claims';
import { DRIVER_APP } from '@/lib/config';

export type Face = 'run' | 'dock' | 'store' | 'plan';

/** A phone-sized face per role; loaders get the Dock tablet on wide screens. */
export const TABLET_MIN_WIDTH = 900;

const ORDER: [Role, Face][] = [
  ['driver', 'run'],
  ['loader', 'dock'],
  ['store_manager', 'store'],
  ['dispatcher', 'plan'],
];

export function faceOf(claims?: Pick<Claims, 'roles'> | null): Face | null {
  if (!claims) return null;
  for (const [role, face] of ORDER) if (claims.roles.includes(role)) return face;
  return null;
}

/** The first screen after sign-in (a key of src/screens/registry.ts). */
export function homeFor(claims: Pick<Claims, 'roles'> | null | undefined, width: number): string | null {
  // the driver's app (lib/config.ts DRIVER_APP) signs in drivers only; every other role uses the website
  if (DRIVER_APP && faceOf(claims) !== 'run') return null;
  switch (faceOf(claims)) {
    case 'run':
      return 'dr-01-today-s-run';
    case 'dock':
      return width >= TABLET_MIN_WIDTH ? 'ld-02-load-sheet-tablet' : 'ld-01-dock-queue';
    case 'store':
      return 'sm-11-today-order-day';
    case 'plan':
      return 'dsp-27-alerts';
    default:
      return null;
  }
}

/** The design's sign-in entry per face. */
export const SIGN_IN: Record<Face, string> = {
  run: 'dr-06-sign-in',
  dock: 'ld-06-sign-in',
  store: 'sm-05-sign-in',
  plan: 'dsp-26-sign-in',
};

export type ProblemKind = 'expired' | 'revoked' | 'unregistered' | 'denied' | 'failed';
export type AccessProblem = { kind: ProblemKind; message: string; at: string };

/** SM-32 "Access request sent": where a phone waits until an admin approves it (every face). */
export const ACCESS_REQUEST_SCREEN = 'sm-32-access-request-sent';

/** The design's access screens: "session expired" and "can't sign in". */
export function accessScreenFor(face: Face | null, kind: ProblemKind): string {
  const expired = kind === 'expired';
  switch (DRIVER_APP ? 'run' : face) {
    case 'run':
      return expired ? 'dr-30-session-expired-while-offline' : 'dr-29-can-t-sign-in';
    case 'dock':
      return expired ? 'ld-25-signed-out-at-shift-end' : 'ld-24-can-t-sign-in';
    case 'store':
      return expired ? 'sm-33-session-expired' : 'sm-31-can-t-sign-in';
    case 'plan':
      return 'dsp-37-can-t-sign-in';
    default:
      return expired ? 'sm-33-session-expired' : 'sm-31-can-t-sign-in';
  }
}

/** Which face a screen key belongs to (for sign-in entry points and access screens). */
export function faceOfScreen(screenKey: string): Face | null {
  if (screenKey.startsWith('dr-')) return 'run';
  if (screenKey.startsWith('ld-')) return 'dock';
  if (screenKey.startsWith('sm-')) return 'store';
  if (screenKey.startsWith('dsp-')) return 'plan';
  return null;
}

/** Classifies a 401 message from the API (DevicePostureService / JwtVerifier) into a problem. */
export function problemFrom401(message: string): ProblemKind {
  if (/revoked/i.test(message)) return 'revoked';
  if (/device|registry/i.test(message)) return 'unregistered';
  return 'expired';
}

export function problemText(kind: ProblemKind, detail?: string): string {
  switch (kind) {
    case 'revoked':
      return 'This phone was removed from Lodestar. Ask the admin to register it again.';
    case 'unregistered':
      return detail && /pending/i.test(detail)
        ? 'This phone is registered and waiting for an admin to approve it.'
        : 'This phone is not registered for your account yet. Ask the admin to approve it.';
    case 'expired':
      return 'Your session ended. Sign in again to send what is saved on this phone.';
    case 'denied':
      return 'Your account cannot use this app.';
    default:
      return detail || 'Sign-in did not complete. Try again.';
  }
}
