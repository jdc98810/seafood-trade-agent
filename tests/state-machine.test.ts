import { describe, expect, it } from "vitest";
import {
  WORKFLOW_STATES,
  assertTransition,
  canTransition,
  progressStepIndex,
} from "@/lib/workflow/state-machine";

describe("状態遷移の白名单", () => {
  it("正常フローの遷移を許可する", () => {
    expect(canTransition("DOCUMENTS_RECEIVING", "DOCUMENTS_RECEIVED")).toBe(true);
    expect(canTransition("VALIDATION_IN_PROGRESS", "NEEDS_REVIEW")).toBe(true);
    expect(canTransition("NEEDS_REVIEW", "WAITING_FOR_SUPPLIER")).toBe(true);
    expect(canTransition("WAITING_FOR_SUPPLIER", "CORRECTION_RECEIVED")).toBe(true);
    expect(canTransition("QUARANTINE_APPROVAL_REQUIRED", "READY_FOR_CUSTOMS_PREPARATION")).toBe(true);
  });

  it("不正な遷移（工程飛ばし）を拒否する", () => {
    expect(canTransition("DOCUMENTS_RECEIVING", "IMPORT_PERMITTED")).toBe(false);
    expect(canTransition("EXTRACTION_IN_PROGRESS", "DELIVERED")).toBe(false);
    expect(() => assertTransition("DOCUMENTS_RECEIVING", "IMPORT_PERMITTED")).toThrow();
  });

  it("ARCHIVEDからはどこへも遷移できない", () => {
    for (const s of WORKFLOW_STATES) {
      if (s !== "ARCHIVED") expect(canTransition("ARCHIVED", s)).toBe(false);
    }
  });

  it("ほぼすべての状態からESCALATEDへ遷移できる", () => {
    expect(canTransition("NEEDS_REVIEW", "ESCALATED")).toBe(true);
    expect(canTransition("CUSTOMS_APPROVAL_REQUIRED", "ESCALATED")).toBe(true);
  });
});

describe("進捗ステップ対応", () => {
  it("すべての状態がいずれかの進捗ステップに属する（ESCALATED除く）", () => {
    for (const s of WORKFLOW_STATES) {
      if (s === "ESCALATED") continue;
      expect(progressStepIndex(s), s).toBeGreaterThanOrEqual(0);
    }
  });
  it("状態と進捗の対応が正しい", () => {
    expect(progressStepIndex("DOCUMENTS_RECEIVING")).toBe(0);
    expect(progressStepIndex("NEEDS_REVIEW")).toBe(3);
    expect(progressStepIndex("ARCHIVED")).toBe(9);
  });
});
