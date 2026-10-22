import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@lodestar/prisma';
import { bearerToken, DevicePostureService, isPrivileged, JwtVerifier, Principal, Roles } from '@lodestar/security';
import { attachRedisAdapter, RedisAdapterHandle } from './redis-adapter';

/** Depot rooms are upper-case (dispatcher:KANDY, loader:KANDY); other ids are kept as given. */
export function canonicalRoom(room: string): string {
  const [kind, id] = room.split(':', 2);
  return (kind === 'dispatcher' || kind === 'loader') && id ? `${kind}:${id.toUpperCase()}` : room;
}

/** The most rooms one socket may ask for in its handshake (the rest are ignored). */
const MAX_ROOMS = 100;

const WS_ORIGINS =(process.env.WS_CORS_ORIGINS ?? 'https://localhost:8443,http://localhost:8082').split(',').map((s) => s.trim());

/**
 * Real-time WebSocket gateway. Connections authenticate with the same access
 * token as HTTP (handshake `auth.token` or Authorization header) and may only
 * join rooms their claims allow.
 * Rooms:
 *   user:<sub>           — personal notifications (joined automatically)
 *   dispatcher:<depot>   — dispatchers see all events for their depot
 *   trip:<tripId>        — ops tracking a specific trip
 *   store:<outletId>     — store manager sees their ETA
 *   driver:<userId>      — driver receives their assigned trip
 *   loader:<depot>       — loader sees bay queue updates
 */
@WebSocketGateway({ cors: { origin: WS_ORIGINS, credentials: true }, path: '/ws/' })
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsGateway.name);
  private redis?: RedisAdapterHandle;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly verifier: JwtVerifier,
    private readonly posture: DevicePostureService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * With REDIS_URL set, room emits fan out across replicas through Redis
   * (PLATFORM.md section 9). Unset: the in-memory adapter (one instance).
   */
  afterInit(server: Server) {
    this.redis = attachRedisAdapter(server);
    this.redis?.ready.catch((err: Error) => this.logger.error(`Socket.IO Redis adapter not attached: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.redis?.close();
  }

  async handleConnection(client: Socket) {
    try {
      const raw = client.handshake.auth?.token ?? bearerToken(client.handshake.headers?.authorization);
      const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : undefined;
      if (!token) throw new Error('missing token');
      const principal = await this.verifier.verify(token);
      await this.posture.check(principal, client.handshake.auth?.deviceId ?? client.handshake.headers?.['x-device-id']);
      client.data.principal = principal;
      client.join(`user:${principal.sub}`);

      const requested = [...new Set(String(client.handshake.query?.room ?? '')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean))].slice(0, MAX_ROOMS);
      // Checked together, not one after another: live operations asks for a trip room per route (DSP-04), and
      // each trip room is a database read. Joined in the order asked for.
      const allowed = await Promise.all(requested.map((room) => this.roomAllowed(principal, canonicalRoom(room)).catch(() => false)));
      requested.forEach((room, i) => {
        // Join the canonical name, so dispatcher:kandy receives dispatcher:KANDY events.
        if (allowed[i]) client.join(canonicalRoom(room));
        else client.emit('room_denied', { room });
      });
      this.logger.log(`WS ${client.id} connected as ${principal.sub} → ${[...client.rooms].join(', ')}`);
    } catch (err) {
      client.emit('unauthorized', { message: 'A valid access token is required' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  /** ABAC for rooms: the same claims that scope OData rows scope realtime events. */
  async roomAllowed(p: Principal, room: string): Promise<boolean> {
    const [kind, id] = room.split(':', 2);
    if (!id) return false;
    if (p.roles.includes(Roles.Admin)) return true;
    switch (kind) {
      case 'user':
      case 'driver':
        return id === p.sub;
      case 'dispatcher':
        return p.roles.includes(Roles.Dispatcher) && p.depots.includes(id.toUpperCase());
      case 'loader':
        return p.roles.includes(Roles.Loader) && p.depots.includes(id.toUpperCase());
      case 'store':
        return p.roles.includes(Roles.StoreManager) && p.outletId === id;
      case 'trip': {
        const trip = await this.prisma.trip.findUnique({
          where: { id },
          select: { depot: true, vehicleId: true, stops: { select: { outletId: true } } },
        });
        if (!trip) return false;
        if (isPrivileged(p)) return true;
        if (p.roles.includes(Roles.Dispatcher) && p.depots.includes(trip.depot)) return true;
        if (p.roles.includes(Roles.Driver) && p.vehicleId === trip.vehicleId) return true;
        return p.roles.includes(Roles.StoreManager) && trip.stops.some((s) => s.outletId === p.outletId);
      }
      default:
        return false;
    }
  }

  /** Emit to all subscribers of a room */
  emit(room: string, event: string, payload: any) {
    this.server?.to(room).emit(event, payload);
  }

  /** Dispatcher-wide alert */
  dispatcherAlert(depot: string, type: string, payload: any) {
    this.emit(`dispatcher:${depot}`, type, payload);
  }

  /** ETA update to store + ops */
  etaUpdate(tripId: string, outletId: string, payload: any) {
    this.emit(`trip:${tripId}`, 'eta_update', payload);
    this.emit(`store:${outletId}`, 'eta_update', payload);
  }

  /** Blackout: signal lost/back to the depot's dispatchers and to the stores still waiting on the trip. */
  blackout(depot: string | undefined, payload: any, outlets: string[] = []) {
    this.signal('signal_lost', depot, payload, outlets);
  }

  blackoutResolved(depot: string | undefined, payload: any, outlets: string[] = []) {
    this.signal('signal_back', depot, payload, outlets);
  }

  private signal(event: 'signal_lost' | 'signal_back', depot: string | undefined, payload: any, outlets: string[]) {
    if (depot) this.dispatcherAlert(depot, event, payload);
    for (const o of outlets) this.emit(`store:${o}`, event, payload);
  }

  /** Credit note issued — notify store manager */
  creditNoteIssued(outletId: string, creditNoteId: string, payload: any) {
    this.emit(`store:${outletId}`, 'credit_note_issued', { ...payload, creditNoteId });
  }
}
