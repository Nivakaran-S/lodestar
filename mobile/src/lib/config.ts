// Where the field app finds the platform (docs/architecture/PLATFORM.md §1).
//   Native (device / simulator): https://localhost:8443 unless EXPO_PUBLIC_API_URL is set.
//   Web (mobile-web container):  the page's own origin. The gateway serves the browser build under /field/
//                                (app.json experiments.baseUrl), next to the desk website, /odata/, /ws/ and /auth/.
// EXPO_PUBLIC_* values are inlined at build time, so they are read with plain `process.env.X` access.
import { Platform } from 'react-native';

const trimSlash = (s: string) => s.replace(/\/+$/, '');

function webOrigin(): string | undefined {
  return typeof window !== 'undefined' && window.location?.origin ? window.location.origin : undefined;
}

export const DEFAULT_API = 'https://localhost:8443';

/** Origin of the gateway (no trailing slash). The OData root is `${apiBase()}/odata/v4`. */
export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return trimSlash(fromEnv);
  if (Platform.OS === 'web') return webOrigin() ?? DEFAULT_API;
  return DEFAULT_API;
}

/** True when API calls go to the page's own origin (no CORS preflight, so extra headers are fine). */
export function sameOriginApi(): boolean {
  if (Platform.OS !== 'web') return true;
  const origin = webOrigin();
  return !!origin && apiBase() === origin;
}

export const ODATA_ROOT = '/odata/v4';

/** Keycloak realm issuer. The browser and the services all see this one issuer: on the web, the page's own origin. */
export function issuer(): string {
  return trimSlash(process.env.EXPO_PUBLIC_OIDC_ISSUER || `${apiBase()}/auth/realms/lodestar`);
}

/** The public, PKCE-only field client (backend/identity/lodestar-realm.json). */
export function clientId(): string {
  return process.env.EXPO_PUBLIC_OIDC_CLIENT_ID || 'lodestar-field';
}

export const APP_SCHEME = 'lodestar';
export const CALLBACK_PATH = 'auth/callback';

/** Web: the path the browser build is served under (app.json experiments.baseUrl, inlined at export), e.g. '/field'. */
export function basePath(): string {
  return trimSlash(process.env.EXPO_BASE_URL ?? '');
}

/** Optional fixed run date (YYYY-MM-DD) for demos against a seeded day. */
export function runDateOverride(): string | undefined {
  const v = process.env.EXPO_PUBLIC_RUN_DATE;
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/**
 * Lodestar Run (the driver's screens, dr-*) is an Android app: the web build leaves it out, unless the build sets
 * EXPO_PUBLIC_RUN_ON_WEB=true (the local stack does, so the e2e suite can drive a run in a browser).
 */
export const RUN_ON_WEB = process.env.EXPO_PUBLIC_RUN_ON_WEB === 'true';

/** True when this build shows the driver's screens: every native build, and the web only when RUN_ON_WEB. */
export function runAvailable(): boolean {
  return Platform.OS !== 'web' || RUN_ON_WEB;
}

/**
 * The phone app is Lodestar Run only: a build with EXPO_PUBLIC_DRIVER_APP=true (the Android build) opens the
 * driver's app, signs in drivers only and has no Store, Plan or Dock screens. Those faces stay on the website.
 */
export const DRIVER_APP = process.env.EXPO_PUBLIC_DRIVER_APP === 'true';

/** The driver's app start (its splash), and the screens it may show besides the driver's own. */
export const DRIVER_APP_START = 'dr-05-splash';
const DRIVER_APP_SHARED = new Set(['sm-32-access-request-sent']);

/** True when this build may show the screen: every screen, or in the driver's app only Run's and the shared ones. */
export function screenInApp(key: string): boolean {
  return !DRIVER_APP || key.startsWith('dr-') || DRIVER_APP_SHARED.has(key);
}
