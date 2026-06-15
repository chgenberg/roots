"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface ImportRow {
  displayName: string;
  email: string;
}

interface ResultRow {
  email: string;
  displayName: string;
  status: "created" | "skipped" | "error";
  reason?: string;
  tempPassword?: string;
}

/**
 * Parsar en CSV-text till rader { displayName, email }.
 *
 * Stödjer komma, semikolon eller tab som avgränsare och en valfri
 * rubrikrad. Kolumnen som innehåller "@" tolkas som e-post, den andra
 * som namn — så ordningen på kolumnerna spelar ingen roll.
 */
function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ImportRow[] = [];
  for (const line of lines) {
    const cols = line
      .split(/[,;\t]/)
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;
    const emailCol = cols.find((c) => c.includes("@"));
    if (!emailCol) continue; // troligen rubrikrad
    const nameCol = cols.find((c) => c !== emailCol && c.length > 0) ?? "";
    rows.push({ displayName: nameCol, email: emailCol.toLowerCase() });
  }
  return rows;
}

export function SellerImportDialog({
  open,
  onOpenChange,
  teamId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  onImported?: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ""));
      setRows(parsed);
      setResults(null);
      if (parsed.length === 0) {
        toast("Hittade inga giltiga rader. Kontrollera filen.", "error");
      }
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const { ok, data } = await apiFetch<{
      results?: ResultRow[];
      summary?: { created: number; skipped: number; errors: number };
      error?: string;
    }>(`/v1/dashboard/team/${teamId}/sellers/import`, {
      method: "POST",
      body: { rows },
    });
    setImporting(false);
    if (ok && data?.results) {
      setResults(data.results);
      const created = data.summary?.created ?? 0;
      toast(`${created} konton skapades.`, created > 0 ? "success" : "default");
      onImported?.();
    } else {
      toast(data?.error || "Importen misslyckades.", "error");
    }
  }

  function copyCredentials() {
    if (!results) return;
    const created = results.filter((r) => r.status === "created");
    const text = created
      .map((r) => `${r.displayName}\t${r.email}\t${r.tempPassword}`)
      .join("\n");
    navigator.clipboard
      .writeText(`Namn\tE-post\tTillfälligt lösenord\n${text}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast("Kunde inte kopiera.", "error"));
  }

  function reset() {
    setRows([]);
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importera säljare från fil</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6 pt-2">
          {!results && (
            <>
              <div className="rounded-lg bg-brand-50 p-3 text-sm text-muted-foreground">
                Spara din Excel-lista som <strong>CSV</strong> (Arkiv → Spara
                som → CSV) med en kolumn för namn och en för e-post. Rubrikrad
                är valfri.
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Välj CSV-fil
              </Button>

              {rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {rows.length} rader inlästa
                  </p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {rows.slice(0, 50).map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium">
                          {r.displayName || (
                            <span className="text-destructive">(namn saknas)</span>
                          )}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {r.email}
                        </span>
                      </div>
                    ))}
                    {rows.length > 50 && (
                      <p className="pt-1 text-xs text-muted-foreground">
                        …och {rows.length - 50} till
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    onClick={runImport}
                    disabled={importing}
                  >
                    {importing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Skapa {rows.length} konton
                  </Button>
                </div>
              )}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-brand-100 text-brand-700">
                  {results.filter((r) => r.status === "created").length} skapade
                </Badge>
                <Badge variant="secondary">
                  {results.filter((r) => r.status === "skipped").length}{" "}
                  hoppade över
                </Badge>
                {results.some((r) => r.status === "error") && (
                  <Badge className="bg-destructive/10 text-destructive">
                    {results.filter((r) => r.status === "error").length} fel
                  </Badge>
                )}
              </div>

              {results.some((r) => r.status === "created") && (
                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Inloggningsuppgifter</p>
                    <Button size="sm" variant="outline" onClick={copyCredentials}>
                      {copied ? (
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      Kopiera alla
                    </Button>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Dela ut de tillfälliga lösenorden. Säljarna kan byta
                    lösenord efter första inloggningen.
                  </p>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {results
                      .filter((r) => r.status === "created")
                      .map((r) => (
                        <div
                          key={r.email}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs"
                        >
                          <span className="truncate font-medium">
                            {r.displayName}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {r.email}
                          </span>
                          <code className="rounded bg-brand-50 px-1.5 py-0.5 font-mono">
                            {r.tempPassword}
                          </code>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {results.some((r) => r.status !== "created") && (
                <div className="space-y-1">
                  {results
                    .filter((r) => r.status !== "created")
                    .map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{r.email || "(tom rad)"}</span>
                        <span>— {r.reason}</span>
                      </div>
                    ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  reset();
                }}
              >
                Importera fler
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
