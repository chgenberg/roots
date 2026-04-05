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

export async function initBankIdAdapter(): Promise<void> {
  if (process.env.BANKID_PFX_PATH) {
    try {
      const { RealBankIdAdapter } = await import("./real-adapter");
      bankIdAdapter = new RealBankIdAdapter();
      realAdapterLoaded = true;
    } catch {
      bankIdAdapter = new MockBankIdAdapter();
    }
  } else {
    bankIdAdapter = new MockBankIdAdapter();
  }
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
