import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { db } from "@roots/db";
import {
  campaigns,
  customerOrderLines,
  customerOrders,
  organizations,
  products,
  sellers,
  teams,
  users,
  warehouseBatches,
} from "@roots/db/schema";
import type { BulkRecipient, WarehouseOrder } from "./shipment";

export { toShipmentOrder, type BulkRecipient, type WarehouseOrder } from "./shipment";

export async function loadWarehouseOrders(
  where: SQL | undefined,
  opts: { limit?: number; orderBy?: SQL[] } = {}
): Promise<WarehouseOrder[]> {
  const query = db
    .select({
      order: customerOrders,
      campaignName: campaigns.name,
      orgName: organizations.name,
      orgDisplayName: organizations.displayName,
      teamName: teams.name,
      sellerName: sellers.displayName,
      batchNumber: warehouseBatches.number,
    })
    .from(customerOrders)
    .innerJoin(campaigns, eq(customerOrders.campaignId, campaigns.id))
    .innerJoin(organizations, eq(customerOrders.orgId, organizations.id))
    .innerJoin(teams, eq(customerOrders.teamId, teams.id))
    .innerJoin(sellers, eq(customerOrders.sellerId, sellers.id))
    .leftJoin(warehouseBatches, eq(customerOrders.warehouseBatchId, warehouseBatches.id))
    .where(where)
    .$dynamic();
  if (opts.orderBy?.length) query.orderBy(...opts.orderBy);
  if (opts.limit) query.limit(opts.limit);
  const rows = await query;
  if (rows.length === 0) return [];

  const lineRows = await db
    .select({
      orderId: customerOrderLines.orderId,
      qty: customerOrderLines.qty,
      unitPriceOre: customerOrderLines.unitPriceOre,
      sku: products.sku,
      productName: products.name,
    })
    .from(customerOrderLines)
    .leftJoin(products, eq(customerOrderLines.productId, products.id))
    .where(
      inArray(
        customerOrderLines.orderId,
        rows.map((r) => r.order.id)
      )
    );
  const linesByOrder = new Map<string, WarehouseOrder["lines"]>();
  for (const line of lineRows) {
    const list = linesByOrder.get(line.orderId) ?? [];
    list.push({
      sku: line.sku,
      productName: line.productName ?? "Okänd produkt",
      qty: line.qty,
      unitPriceOre: line.unitPriceOre,
    });
    linesByOrder.set(line.orderId, list);
  }

  return rows.map(({ order: o, ...rest }) => ({
    id: o.id,
    status: o.status,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    deliveryType: o.deliveryType,
    paymentMethod: o.paymentMethod,
    hasStripePayment: o.paymentMethod === "STRIPE" && !!o.stripeCheckoutSessionId,
    totalOre: o.totalOre,
    shippingOre: o.shippingOre,
    refundedOre: o.refundedOre,
    countsTowardStats: o.countsTowardStats,
    note: o.note,
    customer: { name: o.customerName, email: o.customerEmail || null, phone: o.customerPhone },
    shippingAddress: {
      line1: o.shippingAddressLine1,
      line2: o.shippingAddressLine2,
      postalCode: o.shippingPostalCode,
      city: o.shippingCity,
    },
    campaign: { id: o.campaignId, name: rest.campaignName },
    orgId: o.orgId,
    orgName: rest.orgDisplayName ?? rest.orgName,
    teamId: o.teamId,
    teamName: rest.teamName,
    sellerName: rest.sellerName,
    reconcile: { status: o.reconcileStatus, at: o.reconciledAt, note: o.reconcileNote },
    sentToWarehouseAt: o.sentToWarehouseAt,
    batch:
      o.warehouseBatchId && rest.batchNumber !== null
        ? { id: o.warehouseBatchId, number: rest.batchNumber }
        : null,
    shippedAt: o.shippedAt,
    lines: linesByOrder.get(o.id) ?? [],
  }));
}

/**
 * En mottagare per lag för samlade leveranser. Kunderna hämtar hos
 * lagansvarig, så dit går lådan när lagledaren har en adress. Annars går den
 * till föreningens admin (äldsta kontot, den som registrerade föreningen).
 * Saknar båda adress blir mottagaren utan adress, och plocklistan säger det.
 */
export async function loadBulkRecipients(
  orders: Array<{ teamId: string; orgId: string }>
): Promise<Map<string, BulkRecipient>> {
  const out = new Map<string, BulkRecipient>();
  const teamIds = [...new Set(orders.map((o) => o.teamId))];
  if (teamIds.length === 0) return out;
  const orgIds = [...new Set(orders.map((o) => o.orgId))];

  const contact = {
    contactName: users.contactName,
    phone: users.phone,
    email: users.email,
    addressLine1: users.addressLine1,
    postalCode: users.postalCode,
    city: users.city,
  };

  const leaders = await db
    .select({ teamId: teams.id, orgId: teams.orgId, ...contact })
    .from(teams)
    .innerJoin(users, eq(teams.leaderId, users.id))
    .where(and(inArray(teams.id, teamIds), isNull(users.deletedAt)));

  const admins = await db
    .select({ orgId: users.orgId, createdAt: users.createdAt, ...contact })
    .from(users)
    .where(
      and(
        inArray(users.orgId, orgIds),
        eq(users.role, "ASSOCIATION_ADMIN"),
        isNull(users.deletedAt)
      )
    )
    .orderBy(users.createdAt);
  const adminByOrg = new Map<string, BulkRecipient>();
  for (const admin of admins) {
    if (admin.orgId && !adminByOrg.has(admin.orgId)) adminByOrg.set(admin.orgId, admin);
  }

  for (const order of orders) {
    if (out.has(order.teamId)) continue;
    const leader = leaders.find((l) => l.teamId === order.teamId);
    const admin = adminByOrg.get(order.orgId);
    const recipient = leader?.addressLine1 ? leader : (admin ?? leader);
    if (recipient) out.set(order.teamId, recipient);
  }
  return out;
}
