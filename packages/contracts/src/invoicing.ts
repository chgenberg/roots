export interface InvoiceCustomer {
  orgId: string;
  name: string;
  orgNumber: string;
  email: string;
}

export interface InvoiceLine {
  sku: string;
  description: string;
  qty: number;
  unitPriceOre: number;
}

export interface InvoiceOrder {
  orderId: string;
  customer: InvoiceCustomer;
  lines: InvoiceLine[];
  totalOre: number;
}

export interface InvoiceResult {
  externalId: string | null;
  status: "pending" | "issued" | "error";
  message?: string;
}

export interface InvoiceStatusResult {
  externalId: string;
  status: "pending" | "issued" | "paid" | "cancelled" | "unknown";
}

export interface InvoiceProvider {
  createOrUpdateCustomer(customer: InvoiceCustomer): Promise<string | null>;
  createInvoiceFromOrder(order: InvoiceOrder): Promise<InvoiceResult>;
  getInvoiceStatus(externalId: string): Promise<InvoiceStatusResult>;
}
