"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Modal, btn, field } from "./Modal";

type Field = "orgName" | "email" | "contactName" | "website" | "memberCount";
type Mapping = Record<Field, number | null>;
type SheetPreview = {
  name: string;
  rowCount: number;
  headers: string[];
  sample: string[][];
  mapping: Mapping;
};
type ImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  skippedNoEmail: number;
  skippedNoName: number;
  duplicatesInFile: number;
};

const FIELDS: { id: Field; label: string; required?: boolean }[] = [
  { id: "orgName", label: "Förening", required: true },
  { id: "email", label: "E-post", required: true },
  { id: "contactName", label: "Kontaktperson" },
  { id: "website", label: "Webbplats (för logotypen)" },
  { id: "memberCount", label: "Antal medlemmar" },
];

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function ImportDialog({
  senderId,
  senderName,
  onClose,
  onDone,
}: {
  senderId: string;
  senderName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const sheet = sheets.find((s) => s.name === sheetName) ?? null;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Välj en Excel-fil (.xlsx).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Filen är större än 10 MB.");
      return;
    }
    setBusy(true);
    const b64 = await toBase64(file);
    const { ok, data } = await apiFetch<{ sheets?: SheetPreview[]; error?: string }>(
      `/v1/outreach/senders/${senderId}/import?preview=1`,
      { method: "POST", body: { fileBase64: b64 } }
    );
    setBusy(false);
    if (!ok || !data.sheets?.length) {
      setError(data.error ?? "Filen kunde inte läsas.");
      return;
    }
    setFileName(file.name);
    setFileBase64(b64);
    setSheets(data.sheets);
    const first = data.sheets.find((s) => s.rowCount > 0) ?? data.sheets[0]!;
    setSheetName(first.name);
    setMapping(first.mapping);
  }

  function chooseSheet(name: string) {
    setSheetName(name);
    setMapping(sheets.find((s) => s.name === name)?.mapping ?? null);
  }

  async function runImport() {
    if (!mapping || !sheet) return;
    setBusy(true);
    setError("");
    const { ok, data } = await apiFetch<ImportResult & { error?: string }>(
      `/v1/outreach/senders/${senderId}/import`,
      { method: "POST", body: { fileBase64, sheet: sheet.name, mapping } }
    );
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Importen misslyckades.");
      return;
    }
    setResult(data);
    onDone();
  }

  const cell = (row: string[], f: Field) => {
    const i = mapping?.[f];
    return i === null || i === undefined ? "" : (row[i] ?? "");
  };

  return (
    <Modal title={`Importera föreningar till ${senderName}`} onClose={onClose} wide>
      {result ? (
        <div className="space-y-3 text-sm">
          <p className="text-base font-semibold text-foreground">Klart.</p>
          <ul className="space-y-1 text-foreground">
            <li>{result.created} nya föreningar</li>
            {result.updated > 0 && <li>{result.updated} fanns redan och uppdaterades</li>}
            {result.unchanged > 0 && <li>{result.unchanged} fanns redan och är skickade, så de lämnades orörda</li>}
          </ul>
          {(result.skippedNoEmail > 0 || result.skippedNoName > 0 || result.duplicatesInFile > 0) && (
            <ul className="space-y-1 text-muted-foreground">
              {result.skippedNoEmail > 0 && <li>{result.skippedNoEmail} rader saknade giltig e-post och hoppades över</li>}
              {result.skippedNoName > 0 && <li>{result.skippedNoName} rader saknade föreningsnamn</li>}
              {result.duplicatesInFile > 0 && <li>{result.duplicatesInFile} dubbletter i filen</li>}
            </ul>
          )}
          <div className="pt-2">
            <button type="button" className={btn.primary} onClick={onClose}>
              Stäng
            </button>
          </div>
        </div>
      ) : !sheet ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kolumnerna kan heta olika i olika listor. Agenten gissar vilken som är vad, och du kan
            rätta innan något sparas. Finns en förening redan uppdateras den i stället för att
            läggas till två gånger.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center hover:bg-muted/50">
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">
              {busy ? "Läser filen…" : "Välj Excel-fil (.xlsx)"}
            </span>
            <span className="text-xs text-muted-foreground">
              Förening och e-post krävs. Kontaktperson, webbplats och antal medlemmar fylls i om de finns.
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={busy}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </label>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="font-medium text-foreground">{fileName}</span>
            {sheets.length > 1 && (
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">Blad</span>
                <select value={sheetName} onChange={(e) => chooseSheet(e.target.value)} className={`${field} w-auto py-1.5`}>
                  {sheets.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.rowCount} rader)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.id} className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {f.label}
                  {f.required && " *"}
                </span>
                <select
                  value={mapping?.[f.id] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => m && { ...m, [f.id]: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className={field}
                >
                  <option value="">{f.required ? "Välj kolumn" : "Finns inte"}</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Kolumn ${i + 1}`}
                      {sheet.sample[0]?.[i] ? ` — t.ex. ${sheet.sample[0][i]!.slice(0, 40)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-inset ring-border">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {FIELDS.map((f) => (
                    <th key={f.id} className="px-3 py-2 font-semibold">
                      {f.label.replace(" (för logotypen)", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.sample.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {FIELDS.map((f) => (
                      <td key={f.id} className="max-w-[180px] truncate px-3 py-2 text-foreground">
                        {cell(row, f.id) || <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Så här tolkas de första raderna. Stämmer det inte, ändra kolumnerna ovan.
          </p>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn.primary}
              disabled={busy || mapping?.orgName == null || mapping?.email == null}
              onClick={() => void runImport()}
            >
              {busy ? "Importerar…" : `Importera ${sheet.rowCount.toLocaleString("sv-SE")} rader`}
            </button>
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                setSheets([]);
                setFileBase64("");
              }}
            >
              Välj en annan fil
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
