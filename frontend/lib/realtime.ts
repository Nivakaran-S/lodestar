// Socket.IO client for the notifications service (path /ws/ on the gateway).
// The handshake carries the same access token as HTTP (`auth.token`), re-read on every (re)connect so a renewed
// token is used. The server only lets a socket join rooms its claims allow:
//   user:<sub> (automatic), dispatcher:<depot>, store:<outletId>, trip:<tripId>.
// Events: notification, eta_update, credit_note_issued, signal_lost, signal_back, and dispatcher alerts by type.
import { io, type Socket } from 'socket.io-client';

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'offline';
export type RealtimeHandler = (payload: unknown, event: string) => void;

export interface RealtimeHub {
  /** Subscribe to one event, or '*' for every event. Returns the unsubscribe function. */
  on(event: string, fn: RealtimeHandler): () => void;
  onStatus(fn: (s: RealtimeStatus) => void): () => void;
  status(): RealtimeStatus;
  close(): void;
}

export interface RealtimeOptions {
  origin: string;
  path: string;
  rooms: string[];
  getToken(): Promise<string | null>;
  /** Called when the server rejects the token; resolve to a new one or null. */
  renew(): Promise<string | null>;
  ioImpl?: typeof io;
}

export function createRealtime(opts: RealtimeOptions): RealtimeHub {
  const handlers = new Map<string, Set<RealtimeHandler>>();
  const statusFns = new Set<(s: RealtimeStatus) => void>();
  let status: RealtimeStatus = 'connecting';
  const setStatus = (s: RealtimeStatus) => {
    status = s;
    statusFns.forEach(fn => fn(s));
  };

  const socket: Socket = (opts.ioImpl ?? io)(opts.origin, {
    path: opts.path,
    transports: ['websocket', 'polling'],
    query: opts.rooms.length ? { room: opts.rooms.join(',') } : undefined,
    // A function, so each reconnect asks for a current token.
    auth: cb => {
      opts.getToken().then(token => cb({ token: token ?? '' }), () => cb({ token: '' }));
    },
    withCredentials: false,
    // fail a stuck handshake fast and retry soon: socket.io's 20 s default plus 15 s backoff left DSP-04 on "Reconnecting" ~30 s
    timeout: 8_000,
    reconnectionDelayMax: 5_000,
  });

  const dispatch = (event: string, payload: unknown) => {
    handlers.get(event)?.forEach(fn => fn(payload, event));
    handlers.get('*')?.forEach(fn => fn(payload, event));
  };

  socket.on('connect', () => setStatus('connected'));
  socket.on('disconnect', () => setStatus('offline'));
  socket.on('connect_error', () => setStatus('offline'));
  socket.on('unauthorized', () => {
    // The server disconnects after this. Renew, then connect again with the new token.
    opts.renew().then(token => {
      if (token) socket.connect();
    });
  });
  socket.onAny((event: string, payload: unknown) => dispatch(event, payload));

  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
      return () => handlers.get(event)?.delete(fn);
    },
    onStatus(fn) {
      statusFns.add(fn);
      return () => statusFns.delete(fn);
    },
    status: () => status,
    close() {
      socket.removeAllListeners();
      socket.disconnect();
      setStatus('idle');
    },
  };
}

/** The rooms a desk user joins, from their claims. */
export function roomsFor(session: { roles: string[]; depots: string[]; outletId?: string }): string[] {
  const rooms: string[] = [];
  if (session.roles.includes('dispatcher')) rooms.push(...session.depots.map(d => `dispatcher:${d}`));
  if (session.roles.includes('store_manager') && session.outletId) rooms.push(`store:${session.outletId}`);
  return rooms;
}
