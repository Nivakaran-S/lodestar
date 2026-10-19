// Is there signal? NetInfo (OS / browser connectivity) combined with what the last API call saw:
// a failed fetch marks us offline at once; the next successful call or a NetInfo "connected" marks us back.
import NetInfo from '@react-native-community/netinfo';
import { Store } from '@/lib/store';

export type NetState = { online: boolean; since: string };

export const network = new Store<NetState>({ online: true, since: new Date().toISOString() });

function setOnline(online: boolean) {
  if (network.get().online === online) return;
  network.set({ online, since: new Date().toISOString() });
}

// A failed call while the OS still has a link (a timeout, a slow server) must not leave the app offline: screens
// do not fetch while offline, so no call would ever succeed to bring it back. Try again after a pause, backing off
// while the server keeps failing; any success or an OS change resets it.
const RETRY_FIRST_MS = 10_000;
const RETRY_MAX_MS = 60_000;
let retryMs = RETRY_FIRST_MS;
let retry: ReturnType<typeof setTimeout> | undefined;
function clearRetry() {
  if (retry) clearTimeout(retry);
  retry = undefined;
}

/** Feedback from the API client. */
export function reportReachable(ok: boolean) {
  setOnline(ok);
  if (ok) {
    clearRetry();
    retryMs = RETRY_FIRST_MS;
    return;
  }
  if (!osLink || retry) return;
  retry = setTimeout(() => {
    retry = undefined;
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    if (osLink) setOnline(true);
  }, retryMs);
}

/** What the OS last said (NetInfo isConnected); a failed API call does not change it. */
let osLink = true;
export const osConnected = () => osLink;
function fromOs(connected: boolean) {
  osLink = connected;
  clearRetry();
  retryMs = RETRY_FIRST_MS;
  setOnline(connected);
}

let started = false;

/** Starts listening to the OS / browser (idempotent). */
export function startNetwork(): () => void {
  if (started) return () => undefined;
  started = true;
  // No third-party reachability probe: connectivity comes from the OS / browser, and real API calls
  // report what they see (reportReachable).
  NetInfo.configure({ reachabilityShouldRun: () => false });
  // With the probe off NetInfo reports isInternetReachable=false, so only isConnected counts.
  const unsub = NetInfo.addEventListener(s => fromOs(s.isConnected !== false));
  NetInfo.fetch()
    .then(s => fromOs(s.isConnected !== false))
    .catch(() => undefined);
  // Browsers: NetInfo follows navigator.connection "change" where it exists, which does not fire when
  // the browser goes offline; the window online/offline events do.
  const w = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
  const on = () => setOnline(true);
  const off = () => setOnline(false);
  w?.addEventListener('online', on);
  w?.addEventListener('offline', off);
  return () => {
    unsub();
    w?.removeEventListener('online', on);
    w?.removeEventListener('offline', off);
    started = false;
  };
}
