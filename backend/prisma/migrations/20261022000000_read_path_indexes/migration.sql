-- Indexes for the hot read paths (load sheet, bay queue, store orders, cutoff queue).
-- Additive only; IF NOT EXISTS so a database that already has them migrates cleanly.

CREATE INDEX IF NOT EXISTS "Order_outletId_runDate_idx" ON "orders"."Order"("outletId", "runDate");
CREATE INDEX IF NOT EXISTS "Order_runDate_idx" ON "orders"."Order"("runDate");
CREATE INDEX IF NOT EXISTS "OrderLineItem_orderId_idx" ON "orders"."OrderLineItem"("orderId");
CREATE INDEX IF NOT EXISTS "Trip_depot_runDate_idx" ON "trips"."Trip"("depot", "runDate");
CREATE INDEX IF NOT EXISTS "Trip_planId_idx" ON "trips"."Trip"("planId");
CREATE INDEX IF NOT EXISTS "TripStop_tripId_stopSeq_idx" ON "trips"."TripStop"("tripId", "stopSeq");
