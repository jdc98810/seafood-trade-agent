// 提出準備パッケージのエクスポート（JSON / CSV）。行政システムへは接続しない。

import { NextRequest, NextResponse } from "next/server";
import { buildUnifiedFields, getShipmentDetail } from "@/lib/queries";
import { buildSubmissionPackage, packageToCSV } from "@/lib/agents/package";
import { recordEvent } from "@/lib/workflow/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("kind") === "customs" ? "CUSTOMS" : "QUARANTINE";
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const shipment = await getShipmentDetail(id);
  if (!shipment) return NextResponse.json({ error: "not found" }, { status: 404 });

  const unified = buildUnifiedFields(shipment);
  const pkg = buildSubmissionPackage(kind, {
    shipment: {
      id: shipment.id,
      route: shipment.route,
      product: shipment.product,
      scientificName: shipment.scientificName,
      etd: shipment.etd ? shipment.etd.toISOString().slice(0, 10) : null,
      eta: shipment.eta ? shipment.eta.toISOString().slice(0, 10) : null,
      status: shipment.status,
    },
    unifiedFields: unified.map((f) => ({
      fieldName: f.fieldName,
      normalizedValue: f.normalizedValue,
      originalValue: f.originalValue,
      sourceDocumentType: f.sourceDocumentType,
      pageNumber: f.pageNumber,
      evidenceText: f.evidenceText,
      confidence: f.confidence,
      reviewStatus: f.reviewStatus,
    })),
    documents: shipment.documents
      .filter((d) => d.isActive)
      .map((d) => ({
        documentType: d.documentType,
        fileName: d.fileName,
        version: d.version,
        isFinal: d.isFinal,
      })),
    openIssues: shipment.issues
      .filter((i) => i.status === "OPEN")
      .map((i) => ({ issueType: i.issueType, severity: i.severity, description: i.description })),
  });

  await recordEvent(id, "PACKAGE_EXPORTED", "担当者", `${kind === "QUARANTINE" ? "検疫" : "税関"}パッケージを${format.toUpperCase()}で出力`);

  const base = `${id}_${kind.toLowerCase()}_package`;
  if (format === "csv") {
    return new NextResponse(packageToCSV(pkg), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }
  return new NextResponse(JSON.stringify(pkg, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.json"`,
    },
  });
}
