"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Send, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface QuoteLine {
  product: string;
  qty: number;
  unitPrice: number;
}

export default function OfferterPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [lines, setLines] = useState<QuoteLine[]>([
    { product: "Roots Complete Kit", qty: 10, unitPrice: 399 },
  ]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [clubSearch, setClubSearch] = useState("");

  const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const { toast } = useToast();

  async function handleSaveDraft() {
    setSaving(true);
    // TODO: POST to /v1/quotes/draft
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast("Utkast sparat!", "success");
  }

  async function handleSendQuote() {
    if (!clubSearch.trim()) { toast("Ange en klubb först.", "error"); return; }
    setSending(true);
    // TODO: POST to /v1/quotes/send
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setShowCreate(false);
    toast("Offert skickad!", "success");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offerter</h1>
          <p className="mt-1 text-muted-foreground">
            Skapa och hantera offerter till klubbar.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" />
          Ny offert
        </Button>
      </div>

      {showCreate && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Ny offert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Klubb</Label>
              <Input placeholder="Sök förening..." value={clubSearch} onChange={(e) => setClubSearch(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Produktrader</Label>
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Input value={line.product} className="flex-1" readOnly />
                    <Input
                      type="number"
                      value={line.qty}
                      onChange={(e) => {
                        const updated = [...lines];
                        updated[i].qty = parseInt(e.target.value) || 1;
                        setLines(updated);
                      }}
                      className="w-24"
                    />
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {line.unitPrice} kr/st
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                Totalt: {total.toLocaleString("sv-SE")} kr
              </span>
              <div className="flex gap-3">
                <Button variant="secondary" disabled={saving} onClick={handleSaveDraft}>
                  <FileText className="mr-2 h-4 w-4" />
                  {saving ? "Sparar..." : "Spara utkast"}
                </Button>
                <Button disabled={sending} onClick={handleSendQuote}>
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? "Skickar..." : "Skicka offert"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Klubb</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Giltig till</TableHead>
              <TableHead className="text-right">Summa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                Inga offerter ännu.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
