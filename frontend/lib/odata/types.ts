// Entity shapes of the Lodestar OData service (backend/prisma/schema.prisma, exposed by backend/apps/*/src/*.set(s).ts).
// Dates arrive as ISO strings. Only the fields the desk screens read are typed; responses may carry more.

/** A depot code (PELIYAGODA, KANDY, …): depots are rows of the Depots registry (ADM-21), not a fixed list. */
export type Depot = string;
export type Brand = 'FRESH' | 'STYLE' | 'TECH';
export type TempClass = 'CHILLED' | 'AMBIENT';
export type OrderStatus = 'RECEIVED' | 'PLANNED' | 'LOADED' | 'ENROUTE' | 'DELIVERED' | 'DEFERRED' | 'EXCEPTION' | 'CANCELLED';
export type TripStatus = 'PLANNED' | 'LOADING' | 'ENROUTE' | 'COMPLETE';
export type PlanStatus = 'DRAFT' | 'NEEDS_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'SUPERSEDED';
export type DeferralStatus = 'SUGGESTED' | 'CONFIRMED' | 'DISMISSED' | 'REVERSED';
export type DeferralReason = 'CAP_REEFER' | 'CAP_TIME' | 'ACCESS' | 'WINDOW' | 'FUEL' | 'VEH_DOWN';
export type VehicleStatus = 'AVAILABLE' | 'WORKSHOP' | 'ENROUTE';
export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';
export type UserRole = 'DISPATCHER' | 'LOADER' | 'DRIVER' | 'STORE_MANAGER' | 'ADMIN';

/** A depot as the registry (OData Depots, ADM-21) holds it. Names shown anywhere come from here. */
export interface DepotRow {
  code: string;
  name: string;
  address?: string | null;
  district: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Outlet {
  id: string;
  name: string;
  brand: Brand;
  district: string;
  depot: Depot;
  dockType: 'REAR_DOCK' | 'STREET' | 'MALL_BAY';
  parking: 'NORMAL' | 'VAN_ONLY' | 'MALL_DOCK';
  windowOpen: string;
  windowClose: string;
  address?: string | null;
  accessNote?: string | null;
  lat?: number | null;
  lng?: number | null;
  isActive: boolean;
}

export interface OrderLineItem {
  id: string;
  orderId: string;
  name: string;
  qty: number;
  kg: number;
  tempClass: TempClass;
}

export interface Order {
  id: string;
  outletId: string;
  runDate: string;
  orderedAt: string;
  brand: Brand;
  tempClass: TempClass;
  units: number;
  kg: number;
  m3: number;
  status: OrderStatus;
  deferredYesterday: boolean;
  daysSince: number;
  deferralScore?: number | null;
  notes?: string | null;
  /** The store's count (Orders('…')/Lodestar.ConfirmReceipt); null until the receipt is confirmed. */
  unitsReceived?: number | null;
  /** The units the store expected when it counted (the order's units at the time). */
  unitsExpected?: number | null;
  receiptNote?: string | null;
  /** When the store counted (may be before it reached the server) and when the server recorded it. */
  receiptSavedAt?: string | null;
  receivedAt?: string | null;
  creditNoteId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  outlet?: Outlet;
  lineItems?: OrderLineItem[];
  tripStop?: TripStop | null;
  deferralLog?: Deferral | null;
}

export interface Vehicle {
  id: string;
  depot: Depot;
  type: 'TRUCK' | 'VAN';
  tempClass: TempClass;
  capacityKg: number;
  capacityM3: number;
  kmPerLitre: number;
  weeklyLFuel: number;
  usedLThisWeek: number;
  status: VehicleStatus;
  workshopNote?: string | null;
  updatedAt?: string;
  trips?: Trip[];
}

export interface POD {
  id: string;
  tripStopId: string;
  unitsDelivered: number;
  unitsOrdered: number;
  receiverName?: string | null;
  photoUrl?: string | null;
  /** Photos of the drop held for the stop; photoUrl is the newest (/media/pod-photos/<id>, bearer token). */
  photoCount?: number;
  /** The receiver's signature (/media/pod-photos/<id>, a sanitised SVG), signed by receiverName at signedAt. */
  signatureUrl?: string | null;
  signedAt?: string | null;
  exceptions?: Array<{ type?: string; description?: string }> | string[] | null;
  creditNoteId?: string | null;
  savedOffline: boolean;
  savedAt: string;
  syncedAt?: string | null;
}

export interface TripStop {
  id: string;
  tripId: string;
  orderId: string;
  outletId: string;
  stopSeq: number;
  etaPlan?: string | null;
  etaModel?: string | null;
  etaModelBandEarly?: string | null;
  etaModelBandLate?: string | null;
  lateRiskPct?: number | null;
  serviceMinPredicted?: number | null;
  arrivalActual?: string | null;
  leaveActual?: string | null;
  status: OrderStatus;
  updatedAt?: string;
  trip?: Trip;
  order?: Order;
  outlet?: Outlet;
  pod?: POD | null;
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverId?: string | null;
  depot: Depot;
  runDate: string;
  brand: Brand;
  district: string;
  status: TripStatus;
  planVersion: number;
  tripNumber: number;
  departTime?: string | null;
  returnTime?: string | null;
  planMinutes?: number | null;
  actualMinutes?: number | null;
  sealNumber?: string | null;
  reeferTempC?: number | null;
  bay?: string | null;
  planId?: string | null;
  vehicle?: Vehicle;
  driver?: { id: string; name: string } | null;
  stops?: TripStop[];
  loadRecord?: { loadedAt?: string | null; releasedAt?: string | null; bay?: string | null } | null;
}

export interface PlanSummary {
  orders?: { total?: number; planned?: number; deferred?: number; needsReview?: number };
  chilled?: { demand?: number; capacity?: number; shortM3?: number };
  trips?: number;
  vehiclesInWorkshop?: number;
  suggestions?: Array<{ orderId: string; reason: string; score: number; notes?: string }>;
  /** Hard-rule violations left in the plan; approving it then needs an override reason. */
  violations?: unknown[];
  [k: string]: unknown;
}

export interface Plan {
  id: string;
  depot: Depot;
  runDate: string;
  version: number;
  status: PlanStatus;
  source: 'MANUAL' | 'AUTOPLAN' | 'AGENT';
  summary?: PlanSummary | null;
  explanation?: string | null;
  agentRunId?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  trips?: Trip[];
  deferrals?: Deferral[];
}

export interface Deferral {
  id: string;
  orderId: string;
  reason: DeferralReason;
  score: number;
  resolvedBy?: string | null;
  notes?: string | null;
  rescheduledDate?: string | null;
  isProvisional: boolean;
  status: DeferralStatus;
  confirmedAt?: string | null;
  planId?: string | null;
  createdAt: string;
  updatedAt?: string;
  order?: Order;
  plan?: Plan;
}

export interface Notification {
  id: string;
  recipientId: string;
  tripId?: string | null;
  type: string;
  channel: 'PUSH' | 'SMS' | 'WEBSOCKET';
  payload?: Record<string, unknown> | null;
  sentAt: string;
  readAt?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  depot?: Depot | null;
  outletId?: string | null;
  /** a driver's vehicle (the vehicle_id claim) */
  vehicleId?: string | null;
  /** a loader's Dock sign-in ID, KDY-0427 */
  staffId?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  outlet?: Outlet | null;
  devices?: Device[];
}

export interface Device {
  id: string;
  userId: string;
  label?: string | null;
  platform?: string | null;
  model?: string | null;
  status: DeviceStatus;
  registeredAt: string;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokeReason?: string | null;
  user?: User;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  actorRoles: string[];
  client: string;
  service: string;
  action: string;
  entitySet?: string | null;
  entityKey?: string | null;
  outcome: 'SUCCESS' | 'FAILED' | 'DENIED' | string;
  payload?: unknown;
  prevHash: string;
  hash: string;
}

export interface ChainCheck {
  valid: boolean;
  checked: number;
  headSeq?: number | null;
  headHash?: string | null;
  firstInvalidSeq?: number | null;
  reason?: string | null;
}

export interface OfflineEvent {
  id: string;
  driverId: string;
  tripId?: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  savedAt: string;
  syncedAt?: string | null;
  conflictResolved: boolean;
  conflictNote?: string | null;
}

/** The planning agent's run view (backend/apps/agent, PLATFORM.md §4), stored on AgentRuns.detail. */
export interface AgentTrip {
  id: string;
  vehicleId: string;
  tripNo: number;
  brand: string;
  district: string;
  chilled: boolean;
  orderIds: string[];
  kg: number;
  m3: number;
  minutes: number;
  km?: number;
  litres?: number;
  departs?: string | null;
  returns?: string | null;
  /** The stops in sequence with the agent's times ("05:30", Colombo), service minutes and late risk. */
  stops?: AgentStop[];
}

export interface AgentStop {
  seq: number;
  orderId: string;
  outletId: string;
  arrive?: string | null;
  etaModel?: string | null;
  window?: string | null;
  serviceMin?: number | null;
  lateRiskPct?: number | null;
  dockType?: string | null;
  parking?: string | null;
  protected?: boolean;
}

export interface AgentRunDetail {
  id?: string;
  status?: string;
  version?: number;
  plan?: { version?: number; trips?: AgentTrip[]; unassigned?: Array<{ orderId: string; reason?: string }> };
  ruleChecks?: Array<{ rule: string; label: string; passed: boolean; violations: number }>;
  violations?: Array<{ rule: string; tripId: string; vehicleId: string; orderIds: string[]; reason: string; detail: string }>;
  deferrals?: Array<{ orderId: string; outletId: string; reason: string; score: number; suggested: boolean; m3: number; rank: number }>;
  needsReview?: Array<{ orderId: string; outletId?: string; reason?: string; score?: number; detail?: string }>;
  explanation?: { text: string; did: string[]; checked: string[] };
  decisions?: Array<{ decision: string; by?: string; at?: string; version?: number }>;
  history?: Array<{ node: string; at: string; note?: string }>;
  canPublish?: boolean;
  [k: string]: unknown;
}

export interface AgentRun {
  id: string;
  depot: Depot;
  runDate: string;
  status: 'DRAFTING' | 'RUNNING' | 'NEEDS_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED' | string;
  requestedBy: string;
  planId?: string | null;
  decision?: string | null;
  decidedBy?: string | null;
  detail?: AgentRunDetail | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AgentAnswer {
  answer: string;
  /** The tools the agent used: names (the agent's answer) or {name, args}. */
  toolCalls?: Array<string | { name: string; args?: Record<string, unknown> }>;
  proposal?: { edits: Array<Record<string, unknown>>; draftVersion?: number; ruleChecks?: AgentRunDetail['ruleChecks']; violations?: unknown[] } | null;
}

/** Orders/Lodestar.OrderWindow: whether dispatch closed orders for a depot's run (Orders/Lodestar.CloseOrders). */
export interface OrderWindow {
  depot: string;
  runDate: string;
  closed: boolean;
  closedBy: string | null;
  closedAt: string | null;
  reason: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
}
