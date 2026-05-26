import type {
  InvoiceProvider,
  InvoiceCustomer,
  InvoiceCustomerRef,
  InvoiceOrder,
  InvoiceResult,
  InvoiceStatusResult,
} from "@roots/contracts";
import { childLogger } from "../logger";

const log = childLogger("null-invoice-provider");

/**
 * MASTERPLAN_01 KC1.4 — dev/staging "fake-mode"-implementation av
 * InvoiceProvider. Tidigare returnerade NullProvider bara `null` och
 * loggade — vilket gjorde att settlement-flödet aldrig kunde testas
 * E2E i lokal/staging utan riktigt Fortnox.
 *
 * Nu håller den en in-memory map av:
 *   - kunder (key = orgNumber)
 *   - fakturor (key = vår internal id, samma som Fortnox DocumentNumber-format)
 *
 * Och returnerar realistiska externalId:n (NULL- prefix så de aldrig
 * krockar med riktiga Fortnox-document-nummer om någon panik-rollback
 * blandar dev-data med prod).
 *
 * Mapet rensas vid restart — det är meningen. Detta är en *fake*,
 * inte en parallell sanning. Riktig persistens hör hemma i prod
 * via FortnoxProvider.
 */

interface NullCustomer {
  externalId: string;
  orgNumber: string;
  name: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

interface NullInvoice {
  externalId: string;
  orderId: string;
  customerExternalId: string | null;
  totalOre: number;
  status: "pending" | "issued" | "paid" | "cancelled";
  createdAt: number;
}

let _counter = 1000;
const _customers = new Map<string, NullCustomer>();
const _invoices = new Map<string, NullInvoice>();

function nextCustomerId(): string {
  return `NULL-CUST-${++_counter}`;
}
function nextInvoiceId(): string {
  return `NULL-INV-${++_counter}`;
}

export class NullInvoiceProvider implements InvoiceProvider {
  async findCustomerByOrgNumber(
    orgNumber: string
  ): Promise<InvoiceCustomerRef | null> {
    const c = _customers.get(orgNumber);
    if (!c) return null;
    return {
      externalId: c.externalId,
      orgNumber: c.orgNumber,
      name: c.name,
      email: c.email,
    };
  }

  async createOrUpdateCustomer(
    customer: InvoiceCustomer
  ): Promise<string | null> {
    const existing = _customers.get(customer.orgNumber);
    const now = Date.now();
    if (existing) {
      existing.name = customer.name;
      existing.email = customer.email;
      existing.updatedAt = now;
      log.info(
        { externalId: existing.externalId, orgNumber: customer.orgNumber },
        "[null] updated customer"
      );
      return existing.externalId;
    }
    const externalId = nextCustomerId();
    _customers.set(customer.orgNumber, {
      externalId,
      orgNumber: customer.orgNumber,
      name: customer.name,
      email: customer.email,
      createdAt: now,
      updatedAt: now,
    });
    log.info(
      { externalId, orgNumber: customer.orgNumber, name: customer.name },
      "[null] created customer"
    );
    return externalId;
  }

  async createInvoiceFromOrder(order: InvoiceOrder): Promise<InvoiceResult> {
    // Säkerställ att kunden finns innan vi "skapar" fakturan — speglar
    // beteendet i FortnoxProvider där /invoices kräver att kund finns.
    let customerExternalId: string | null = null;
    if (order.customer.orgNumber) {
      const existing = await this.findCustomerByOrgNumber(
        order.customer.orgNumber
      );
      customerExternalId =
        existing?.externalId ??
        (await this.createOrUpdateCustomer(order.customer));
    }

    const externalId = nextInvoiceId();
    _invoices.set(externalId, {
      externalId,
      orderId: order.orderId,
      customerExternalId,
      totalOre: order.totalOre,
      status: "issued",
      createdAt: Date.now(),
    });
    log.info(
      {
        externalId,
        orderId: order.orderId,
        totalSEK: order.totalOre / 100,
        customerExternalId,
      },
      "[null] issued invoice"
    );
    return { externalId, status: "issued" };
  }

  async getInvoiceStatus(externalId: string): Promise<InvoiceStatusResult> {
    const inv = _invoices.get(externalId);
    if (!inv) {
      return { externalId, status: "unknown" };
    }
    return { externalId, status: inv.status };
  }
}

/**
 * Test/runbook-only: tvinga en faktura till status "paid" så vi kan
 * verifiera payout-PAID-flödet E2E utan riktigt Fortnox. Inte exporterad
 * via providers-API:t — kalla direkt från test eller dev-script.
 */
export function __markNullInvoiceAsPaidForDev(externalId: string): boolean {
  const inv = _invoices.get(externalId);
  if (!inv) return false;
  inv.status = "paid";
  return true;
}

/** Test-only reset. */
export function __resetNullProviderForTests(): void {
  _customers.clear();
  _invoices.clear();
  _counter = 1000;
}
