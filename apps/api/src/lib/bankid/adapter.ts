export interface BankIdAuthResult {
  personalNumber: string;
  name: string;
  givenName: string;
  surname: string;
}

export interface BankIdStartResult {
  orderRef: string;
  autoStartToken: string;
  qrStartToken: string;
  qrStartSecret: string;
}

export interface BankIdAdapter {
  startAuth(endUserIp: string): Promise<BankIdStartResult>;
  collect(orderRef: string): Promise<
    | { status: "pending"; hintCode: string }
    | { status: "complete"; user: BankIdAuthResult }
    | { status: "failed"; hintCode: string }
  >;
  cancel(orderRef: string): Promise<void>;
}

export class MockBankIdAdapter implements BankIdAdapter {
  async startAuth(_endUserIp: string): Promise<BankIdStartResult> {
    return {
      orderRef: crypto.randomUUID(),
      autoStartToken: "mock-token",
      qrStartToken: "mock-qr-start",
      qrStartSecret: "mock-qr-secret",
    };
  }

  async collect(_orderRef: string) {
    return {
      status: "complete" as const,
      user: {
        personalNumber: "199001011234",
        name: "Test Testsson",
        givenName: "Test",
        surname: "Testsson",
      },
    };
  }

  async cancel(_orderRef: string) {}
}

let bankIdAdapter: BankIdAdapter | null = null;
let realAdapterLoaded = false;

/**
 * Mock-adaptern godkänner ALLA identifieringar som "Test Testsson". Att falla
 * tillbaka på den tyst vore en fälla: den dagen BankID kopplas till ett
 * riktigt behörighetsbeslut skulle en felkonfigurerad prod-deploy släppa
 * igenom vem som helst. Därför loggar vi högt när det händer, och
 * `bankIdMode()` rapporterar vad som faktiskt är laddat — inte vad env antyder.
 */
export async function initBankIdAdapter(): Promise<void> {
  realAdapterLoaded = false;

  if (!process.env.BANKID_PFX_PATH) {
    bankIdAdapter = new MockBankIdAdapter();
    return;
  }

  try {
    const { RealBankIdAdapter } = await import("./real-adapter");
    bankIdAdapter = new RealBankIdAdapter();
    realAdapterLoaded = true;
  } catch (err) {
    bankIdAdapter = new MockBankIdAdapter();
    const { childLogger } = await import("../logger");
    childLogger("bankid").error(
      { err },
      "BANKID_PFX_PATH är satt men den riktiga adaptern kunde inte laddas — " +
        "faller tillbaka på mock som godkänner alla identifieringar"
    );
  }
}

/** Vilken adapter som faktiskt körs just nu. */
export function bankIdMode(): "production" | "test" | "mock" {
  if (!realAdapterLoaded) return "mock";
  return process.env.BANKID_ENV === "production" ? "production" : "test";
}

export function getBankIdAdapter(): BankIdAdapter {
  if (!bankIdAdapter) {
    bankIdAdapter = new MockBankIdAdapter();
  }
  return bankIdAdapter;
}

export function setBankIdAdapter(adapter: BankIdAdapter) {
  bankIdAdapter = adapter;
}
