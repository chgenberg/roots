import type { WarehouseShipmentOrder } from "./provider";

/**
 * En kundorder med det lagervyn, plocklistan och lagret behöver veta:
 * vem som sålt, vad som ska plockas och vart det ska.
 */
export interface WarehouseOrder {
  id: string;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  deliveryType: "BULK" | "DIRECT";
  paymentMethod: string;
  hasStripePayment: boolean;
  totalOre: number;
  shippingOre: number;
  refundedOre: number;
  /** false = lagd utanför säljperioden. Säljperiodens ordrar går först. */
  countsTowardStats: boolean;
  note: string | null;
  customer: { name: string; email: string | null; phone: string | null };
  /** Kundens adress vid hemleverans. */
  shippingAddress: {
    line1: string | null;
    line2: string | null;
    postalCode: string | null;
    city: string | null;
  };
  campaign: { id: string; name: string };
  orgId: string;
  orgName: string;
  teamId: string;
  teamName: string;
  sellerName: string;
  reconcile: { status: string | null; at: Date | null; note: string | null };
  sentToWarehouseAt: Date | null;
  batch: { id: string; number: number } | null;
  shippedAt: Date | null;
  lines: Array<{ sku: string | null; productName: string; qty: number; unitPriceOre: number }>;
}

/**
 * Mottagaren vid samlad leverans: lagets ansvarige, eller föreningens
 * admin när lagledaren inte har någon adress.
 */
export interface BulkRecipient {
  contactName: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
}

/** Vart ordern ska: kunden vid hemleverans, föreningens kontaktperson annars. */
export function toShipmentOrder(
  order: WarehouseOrder,
  bulk: BulkRecipient | undefined
): WarehouseShipmentOrder {
  const direct = order.deliveryType === "DIRECT";
  return {
    orderId: order.id,
    deliveryType: order.deliveryType,
    recipientName: direct
      ? order.customer.name
      : [`${order.orgName}, ${order.teamName}`, bulk?.contactName]
          .filter(Boolean)
          .join(", c/o "),
    addressLine1: direct ? order.shippingAddress.line1 : (bulk?.addressLine1 ?? null),
    addressLine2: direct ? order.shippingAddress.line2 : null,
    postalCode: direct ? order.shippingAddress.postalCode : (bulk?.postalCode ?? null),
    city: direct ? order.shippingAddress.city : (bulk?.city ?? null),
    phone: direct ? order.customer.phone : (bulk?.phone ?? null),
    email: direct ? order.customer.email : (bulk?.email ?? null),
    lines: order.lines.map((l) => ({ sku: l.sku, productName: l.productName, qty: l.qty })),
  };
}
