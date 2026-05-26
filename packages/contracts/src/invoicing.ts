export interface InvoiceCustomer {
  orgId: string;
  name: string;
  orgNumber: string;
  email: string;
  /** Optional postal address — populeras när vi har full klubb-data. */
  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
  };
  /** Optional phone number — Fortnox accepterar det på Customer-objektet. */
  phone?: string;
}

/**
 * MASTERPLAN_01 KC1.4: utöka InvoiceLine med VAT + bok-koppling.
 *
 * Fortnox kräver `VATPercent` (annars hamnar raden under "Övrigt"
 * istället för 25%-momsen i bok-rapporten). `AccountNumber` styr
 * vilken intäktskonto i SIE-export (3001 default). `ArticleNumber`
 * är vår SKU så bok-rapporten kan grupperas per produkt.
 *
 * Alla tre är `?` så NullProvider och äldre callers fortsätter
 * fungera. FortnoxProvider faller tillbaka på defaults.
 */
export interface InvoiceLine {
  sku: string;
  description: string;
  qty: number;
  unitPriceOre: number;
  /** Default 25 (svensk standardmoms). */
  vatPercent?: number;
  /** Default 3001 (försäljning Sverige, 25% moms). */
  accountNumber?: number;
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

/**
 * MASTERPLAN_01 KC1.4: split:a createOrUpdateCustomer i en
 * lookup-by-orgNumber + en explicit upsert. Det låter call-site:n
 * (settlement.ts) först söka — om kunden finns gör vi PUT-update
 * av e-post/adress; om inte, POST. Tidigare POST:ade vi blint
 * varje gång → Fortnox loggade en `409 Conflict` och vi gav upp
 * → faktura hamnade utan kundkoppling.
 *
 * `findCustomerByOrgNumber` returnerar `null` när kunden inte finns
 * (404), eller en `InvoiceCustomerRef` med `externalId` när den gör.
 */
export interface InvoiceCustomerRef {
  /** Provider-side ID (CustomerNumber i Fortnox). */
  externalId: string;
  orgNumber: string;
  name: string;
  email: string;
}

export interface InvoiceProvider {
  /** Söker efter en kund på org-nr. Returnerar null vid 404. */
  findCustomerByOrgNumber(orgNumber: string): Promise<InvoiceCustomerRef | null>;
  /**
   * Upsert: provider:n ansvarar för att antingen PUT:a (om kund med
   * samma orgNumber finns) eller POST:a en ny. Returnerar externalId
   * eller null vid fel.
   */
  createOrUpdateCustomer(customer: InvoiceCustomer): Promise<string | null>;
  createInvoiceFromOrder(order: InvoiceOrder): Promise<InvoiceResult>;
  getInvoiceStatus(externalId: string): Promise<InvoiceStatusResult>;
}
