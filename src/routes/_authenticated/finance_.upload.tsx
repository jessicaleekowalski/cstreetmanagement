import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { listProperties, uploadFinancials, uploadBudgets, uploadTransactions, uploadValuations, clearFinancialData } from "@/lib/rpm.functions";
import { PageHeader } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Download, Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance_/upload")({
  head: () => ({ meta: [{ title: "Upload financial data — C Street Management Group" }] }),
  component: UploadPage,
});

type Kind = "financials" | "budgets" | "transactions" | "valuations";

const TEMPLATES: Record<Kind, { headers: string[]; sample: (string | number)[][]; description: string }> = {
  financials: {
    description: "Monthly income and expenses per property. One row per property per month.",
    headers: ["property_id", "period_month", "gross_income", "operating_expenses", "other_income", "notes"],
    sample: [["<property_id>", "2026-01", 12500, 4200, 0, "Jan rent + parking"]],
  },
  budgets: {
    description: "Annual budget line items by category. One row per property/year/category.",
    headers: ["property_id", "year", "category", "budgeted_amount", "notes"],
    sample: [["<property_id>", 2026, "Repairs & Maintenance", 15000, ""]],
  },
  transactions: {
    description: "General ledger transactions. txn_type must be 'income' or 'expense'.",
    headers: ["property_id", "txn_date", "txn_type", "category", "vendor", "description", "amount"],
    sample: [["<property_id>", "2026-03-14", "expense", "Repairs & Maintenance", "ABC Plumbing", "Water heater repair", 875.50]],
  },
  valuations: {
    description: "Property market values. Used to compute cap rate.",
    headers: ["property_id", "as_of_date", "market_value", "source"],
    sample: [["<property_id>", "2026-01-01", 1450000, "Broker BPO"]],
  },
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[$,]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(v).trim();
}

function normalizeRows(kind: Kind, raw: Record<string, unknown>[]): unknown[] {
  return raw.map(row => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) r[k.trim().toLowerCase().replace(/\s+/g, "_")] = v;
    switch (kind) {
      case "financials":
        return {
          property_id: String(r.property_id ?? "").trim(),
          period_month: normalizeDate(r.period_month ?? r.month),
          gross_income: toNum(r.gross_income),
          operating_expenses: toNum(r.operating_expenses ?? r.opex),
          other_income: toNum(r.other_income),
          notes: r.notes ? String(r.notes) : null,
        };
      case "budgets":
        return {
          property_id: String(r.property_id ?? "").trim(),
          year: Number(r.year),
          category: String(r.category ?? "").trim(),
          budgeted_amount: toNum(r.budgeted_amount ?? r.amount),
          notes: r.notes ? String(r.notes) : null,
        };
      case "transactions":
        return {
          property_id: String(r.property_id ?? "").trim(),
          txn_date: normalizeDate(r.txn_date ?? r.date),
          txn_type: String(r.txn_type ?? r.type ?? "expense").trim().toLowerCase(),
          category: r.category ? String(r.category) : null,
          vendor: r.vendor ? String(r.vendor) : null,
          description: r.description ? String(r.description) : null,
          amount: toNum(r.amount),
        };
      case "valuations":
        return {
          property_id: String(r.property_id ?? "").trim(),
          as_of_date: normalizeDate(r.as_of_date ?? r.date),
          market_value: toNum(r.market_value ?? r.value),
          source: r.source ? String(r.source) : null,
        };
    }
  });
}

async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => resolve(r.data as Record<string, unknown>[]),
        error: e => reject(e),
      });
    });
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
}

function downloadTemplate(kind: Kind, format: "csv" | "xlsx") {
  const tpl = TEMPLATES[kind];
  const rows = [tpl.headers, ...tpl.sample];
  if (format === "csv") {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${kind}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  } else {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kind);
    XLSX.writeFile(wb, `${kind}-template.xlsx`);
  }
}

function UploadPage() {
  const [kind, setKind] = useState<Kind>("financials");
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/finance"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Finance</Button></Link>
      </div>
      <PageHeader
        title="Upload financial data"
        description="Upload CSV or Excel files to power the finance dashboard. Download a template, fill it in, and upload."
      />
      <PropertyIdReference />
      <Tabs value={kind} onValueChange={v => setKind(v as Kind)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="financials">Income & expenses</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="valuations">Valuations</TabsTrigger>
        </TabsList>
        {(["financials", "budgets", "transactions", "valuations"] as Kind[]).map(k => (
          <TabsContent key={k} value={k}>
            <UploadPanel kind={k} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PropertyIdReference() {
  const fn = useServerFn(listProperties);
  const { data } = useQuery({ queryKey: ["properties"], queryFn: () => fn() });
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Your property IDs</CardTitle></CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground mb-2">Copy the ID into your uploaded rows.</div>
        <div className="rounded border bg-muted/30 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">property_id</th></tr></thead>
            <tbody className="divide-y">
              {(data ?? []).map(p => (
                <tr key={p.id}>
                  <td className="px-2 py-1">{p.name}</td>
                  <td className="px-2 py-1 font-mono">{p.id}</td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan={2} className="text-center text-muted-foreground py-3">No properties yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadPanel({ kind }: { kind: Kind }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<unknown[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const upFin = useServerFn(uploadFinancials);
  const upBud = useServerFn(uploadBudgets);
  const upTxn = useServerFn(uploadTransactions);
  const upVal = useServerFn(uploadValuations);
  const clearFn = useServerFn(clearFinancialData);
  const tpl = TEMPLATES[kind];

  const upload = useMutation({
    mutationFn: async () => {
      if (kind === "financials") return upFin({ data: { rows: rows as never } });
      if (kind === "budgets") return upBud({ data: { rows: rows as never } });
      if (kind === "transactions") return upTxn({ data: { rows: rows as never } });
      return upVal({ data: { rows: rows as never } });
    },
    onSuccess: (res) => {
      toast.success(`Uploaded ${res.inserted} row${res.inserted === 1 ? "" : "s"}`);
      setRows([]); setFileName(""); setError(null);
      qc.invalidateQueries({ queryKey: ["finance-overview"] });
    },
    onError: (e: Error) => { setError(e.message); toast.error(e.message); },
  });

  const clearAll = useMutation({
    mutationFn: () => clearFn({ data: { kind } }),
    onSuccess: () => { toast.success("Cleared"); qc.invalidateQueries({ queryKey: ["finance-overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFile = async (file: File) => {
    try {
      setError(null); setFileName(file.name);
      const parsed = await parseFile(file);
      const normalized = normalizeRows(kind, parsed).filter((r) => {
        const rr = r as Record<string, unknown>;
        return rr.property_id && String(rr.property_id).length === 36;
      });
      if (normalized.length === 0) throw new Error("No valid rows found. Check property_id column.");
      setRows(normalized);
    } catch (e) { setError((e as Error).message); setRows([]); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{tpl.description}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(kind, "csv")}><Download className="h-4 w-4 mr-2" /> CSV template</Button>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(kind, "xlsx")}><Download className="h-4 w-4 mr-2" /> Excel template</Button>
          <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={() => { if (confirm(`Delete all ${kind}?`)) clearAll.mutate(); }}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear all {kind}
          </Button>
        </div>

        <div className="rounded-lg border-2 border-dashed p-6 text-center">
          <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
            />
            <span className="text-sm text-primary underline">Choose a CSV or Excel file</span>
          </label>
          {fileName && <div className="text-xs text-muted-foreground mt-1">{fileName}</div>}
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="text-xs text-muted-foreground">
          Expected columns: <span className="font-mono">{tpl.headers.join(", ")}</span>
        </div>

        {rows.length > 0 && (
          <>
            <div className="rounded border bg-card overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0"><tr>{Object.keys(rows[0] as object).map(k => <th key={k} className="text-left px-2 py-1 font-medium">{k}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i}>{Object.values(r as object).map((v, j) => <td key={j} className="px-2 py-1 font-mono">{v == null ? "" : String(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"} ready {rows.length > 20 && "(showing first 20)"}</div>
              <Button className="ml-auto" onClick={() => upload.mutate()} disabled={upload.isPending}>
                {upload.isPending ? "Uploading…" : `Upload ${rows.length} row${rows.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
