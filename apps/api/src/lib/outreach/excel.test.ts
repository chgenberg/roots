import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildExport, loadWorkbook, parseLeads, previewWorkbook, suggestMapping } from "./excel";

async function workbook(rows: (string | number | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Blad1");
  for (const r of rows) ws.addRow(r);
  return loadWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
}

describe("suggestMapping", () => {
  it("läser Kent och Niclas rubriker", () => {
    expect(suggestMapping(["Namn", "Epost", "Url", "Antal medlemmar", "Intäkt"])).toEqual({
      orgName: 0,
      email: 1,
      website: 2,
      memberCount: 3,
      contactName: null,
    });
  });

  it("läser den nationella listan, där Namn saknas men Kundnamn och Kontaktperson finns", () => {
    const m = suggestMapping(["Kundnamn", "Län", "E-post", "Telefonnummer", "Kontaktperson"]);
    expect(m).toMatchObject({ orgName: 0, email: 2, contactName: 4, website: null, memberCount: null });
  });

  it("läser utskicksflikarna, där Antal deltagare är räknetalet och källans medlemsantal står bredvid", () => {
    const m = suggestMapping([
      "Förening", "Kontaktperson", "E-post", "Fler e-postadresser", "Webbplats",
      "Antal deltagare", "Medlemmar enligt källa",
    ]);
    expect(m).toEqual({ orgName: 0, contactName: 1, email: 2, website: 4, memberCount: 5 });
  });
});

describe("parseLeads", () => {
  it("rensar e-post, webbplats och medlemsantal och hoppar över rader utan e-post", async () => {
    const wb = await workbook([
      ["Namn", "Epost", "Url", "Antal medlemmar"],
      ["Storvreta IBK", " Kansli@StorvretaIBK.se ", "storvretaibk.se", "ca 450"],
      ["Vaksala SK", "", "vaksalask.se", 300],
      ["Dubblett IBK", "kansli@storvretaibk.se", "", 10],
      ["SK Vide", "info@skvide.se; ordf@skvide.se", "https://www.skvide.se/", null],
    ]);
    const [sheet] = previewWorkbook(wb);
    expect(sheet!.rowCount).toBe(4);
    const res = parseLeads(wb, "Blad1", sheet!.mapping);
    expect(res.skippedNoEmail).toBe(1);
    expect(res.duplicatesInFile).toBe(1);
    expect(res.leads).toEqual([
      { orgName: "Storvreta IBK", contactName: null, email: "kansli@storvretaibk.se", website: "https://storvretaibk.se", memberCount: 450 },
      { orgName: "SK Vide", contactName: null, email: "info@skvide.se", website: "https://www.skvide.se", memberCount: null },
    ]);
  });
});

describe("buildExport", () => {
  it("skriver en läsbar arbetsbok", async () => {
    const buf = await buildExport("Niclas", [
      {
        orgName: "Storvreta IBK",
        contactName: null,
        email: "kansli@storvretaibk.se",
        website: null,
        memberCount: 10,
        totalKr: 23940,
        associationKr: 8379,
        proposalUrl: "https://roots.nu/f/x",
        status: "Utkast",
        sentAt: null,
        proposalOpenCount: 0,
        proposalOpenedAt: null,
        note: null,
      },
    ]);
    const wb = await loadWorkbook(buf);
    expect(wb.getWorksheet("Leads")!.getRow(2).getCell(1).value).toBe("Storvreta IBK");
  });
});
