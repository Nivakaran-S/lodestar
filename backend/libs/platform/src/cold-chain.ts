/**
 * The cold chain's one limit: a reefer must read at or below this before it leaves the dock (Trips/Release) and
 * while on the road (sync REEFER_TEMP alerts). The Dock app checks it too; the server is the rule.
 */
export const REEFER_MAX_C = 4;
