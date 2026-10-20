import { describe, expect, it } from "vitest";
import {
  DEFAULT_BODY_TEMPLATE,
  DEFAULT_SUBJECT_TEMPLATE,
  calculateLead,
  renderLeadMail,
} from "./template";

const sender: { name: string; title: string; phone: string | null; email: string } = {
  name: "Niclas Corse",
  title: "Föreningsrepresentant",
  phone: "070-123 45 67",
  email: "niclas@roots.nu",
};

const lead: {
  orgName: string;
  contactName: string | null;
  memberCount: number | null;
  packagesPerMember: number;
  packagePriceKr: number;
} = {
  orgName: "Storvreta IBK",
  contactName: "Henrik Ededahl",
  memberCount: 120,
  packagesPerMember: 6,
  packagePriceKr: 399,
};

function render(overrides: Partial<typeof lead> = {}, senderOverrides: Partial<typeof sender> = {}) {
  return renderLeadMail({
    subjectTemplate: DEFAULT_SUBJECT_TEMPLATE,
    bodyTemplate: DEFAULT_BODY_TEMPLATE,
    sender: { ...sender, ...senderOverrides },
    lead: { ...lead, ...overrides },
    proposalUrl: "https://roots.nu/f/abc123",
  });
}

describe("calculateLead", () => {
  it("räknar 6 × 399 kr per medlem och 35 % till föreningen", () => {
    expect(calculateLead(lead)).toEqual({ perMemberKr: 2394, totalKr: 287280, associationKr: 100548 });
  });

  it("ger inget räkneexempel utan antal medlemmar", () => {
    expect(calculateLead({ ...lead, memberCount: null })).toBeNull();
  });
});

describe("renderLeadMail", () => {
  it("fyller alla fält och lämnar inga hakparenteser", () => {
    const mail = render();
    expect(mail.missing).toEqual([]);
    expect(mail.subject).toBe("Ett förslag till Storvreta IBK från Roots");
    expect(mail.text).toContain("Hej Henrik!");
    expect(mail.text).toContain("Niclas Corse här!");
    expect(mail.text).toContain("120 medlemmar × 2 394 kr = 287 280 kr i försäljning");
    expect(mail.text).toContain("innebär det 100 548 kr till Storvreta IBK");
    expect(mail.text).toContain("att varje medlem säljer 6 paket à 399 kr");
    expect(mail.text).toContain("Se förslaget för Storvreta IBK: https://roots.nu/f/abc123");
    expect(mail.text).not.toMatch(/\[[^\]]+\]/);
    expect(mail.html).toContain('href="https://roots.nu/f/abc123"');
  });

  it("hälsar utan namn när kontaktperson saknas", () => {
    expect(render({ contactName: null }).text.startsWith("Hej!")).toBe(true);
  });

  it("stoppar mejlet när antal medlemmar saknas", () => {
    expect(render({ memberCount: null }).missing).toEqual(["Antal medlemmar saknas"]);
  });

  it("tar bort telefonraden när avsändaren saknar nummer", () => {
    const mail = render({}, { phone: null });
    expect(mail.text).toContain("Föreningsrepresentant | Roots\nniclas@roots.nu");
  });

  it("escapar föreningsnamnet i html", () => {
    const mail = render({ orgName: "IK <script>" });
    expect(mail.html).not.toContain("<script>");
  });
});
