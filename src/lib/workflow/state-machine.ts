// 仕様書 §9 のワークフロー状態と遷移白名单。
// 状態遷移はここを唯一の入口とし、すべて WorkflowEvent に記録する。

export const WORKFLOW_STATES = [
  "DOCUMENTS_RECEIVING",
  "DOCUMENTS_RECEIVED",
  "EXTRACTION_IN_PROGRESS",
  "EXTRACTION_COMPLETE",
  "NORMALIZATION_COMPLETE",
  "VALIDATION_IN_PROGRESS",
  "NEEDS_REVIEW",
  "WAITING_FOR_SUPPLIER",
  "CORRECTION_RECEIVED",
  "READY_FOR_QUARANTINE_PREPARATION",
  "QUARANTINE_DRAFT_READY",
  "QUARANTINE_APPROVAL_REQUIRED",
  "READY_FOR_CUSTOMS_PREPARATION",
  "CUSTOMS_PACKAGE_READY",
  "CUSTOMS_APPROVAL_REQUIRED",
  "IMPORT_PERMITTED",
  "DELIVERY_ARRANGED",
  "DELIVERED",
  "ARCHIVED",
  "ESCALATED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const STATE_LABELS_JA: Record<WorkflowState, string> = {
  DOCUMENTS_RECEIVING: "書類受領中",
  DOCUMENTS_RECEIVED: "書類受領完了",
  EXTRACTION_IN_PROGRESS: "情報抽出中",
  EXTRACTION_COMPLETE: "情報抽出完了",
  NORMALIZATION_COMPLETE: "データ正規化完了",
  VALIDATION_IN_PROGRESS: "検証中",
  NEEDS_REVIEW: "人間確認待ち",
  WAITING_FOR_SUPPLIER: "輸出者回答待ち",
  CORRECTION_RECEIVED: "修正版受領",
  READY_FOR_QUARANTINE_PREPARATION: "検疫準備可能",
  QUARANTINE_DRAFT_READY: "検疫草案作成済み",
  QUARANTINE_APPROVAL_REQUIRED: "検疫草案承認待ち",
  READY_FOR_CUSTOMS_PREPARATION: "税関準備可能",
  CUSTOMS_PACKAGE_READY: "税関資料作成済み",
  CUSTOMS_APPROVAL_REQUIRED: "税関資料承認待ち",
  IMPORT_PERMITTED: "輸入許可",
  DELIVERY_ARRANGED: "納品手配済み",
  DELIVERED: "納品完了",
  ARCHIVED: "保存済み",
  ESCALATED: "エスカレーション中",
};

// 各状態から遷移できる先。ここに無い遷移は不正としてエラーにする。
const TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  DOCUMENTS_RECEIVING: ["DOCUMENTS_RECEIVED", "ESCALATED"],
  DOCUMENTS_RECEIVED: ["EXTRACTION_IN_PROGRESS", "DOCUMENTS_RECEIVING", "ESCALATED"],
  EXTRACTION_IN_PROGRESS: ["EXTRACTION_COMPLETE", "NEEDS_REVIEW", "ESCALATED"],
  EXTRACTION_COMPLETE: ["NORMALIZATION_COMPLETE", "NEEDS_REVIEW", "ESCALATED"],
  NORMALIZATION_COMPLETE: ["VALIDATION_IN_PROGRESS", "ESCALATED"],
  VALIDATION_IN_PROGRESS: [
    "NEEDS_REVIEW",
    "READY_FOR_QUARANTINE_PREPARATION",
    "ESCALATED",
  ],
  NEEDS_REVIEW: [
    "WAITING_FOR_SUPPLIER",
    "READY_FOR_QUARANTINE_PREPARATION",
    "VALIDATION_IN_PROGRESS",
    "ESCALATED",
  ],
  WAITING_FOR_SUPPLIER: ["CORRECTION_RECEIVED", "NEEDS_REVIEW", "ESCALATED"],
  CORRECTION_RECEIVED: ["EXTRACTION_IN_PROGRESS", "VALIDATION_IN_PROGRESS", "ESCALATED"],
  READY_FOR_QUARANTINE_PREPARATION: ["QUARANTINE_DRAFT_READY", "NEEDS_REVIEW", "ESCALATED"],
  QUARANTINE_DRAFT_READY: ["QUARANTINE_APPROVAL_REQUIRED", "ESCALATED"],
  QUARANTINE_APPROVAL_REQUIRED: [
    "READY_FOR_CUSTOMS_PREPARATION",
    "QUARANTINE_DRAFT_READY",
    "NEEDS_REVIEW",
    "ESCALATED",
  ],
  READY_FOR_CUSTOMS_PREPARATION: ["CUSTOMS_PACKAGE_READY", "NEEDS_REVIEW", "ESCALATED"],
  CUSTOMS_PACKAGE_READY: ["CUSTOMS_APPROVAL_REQUIRED", "ESCALATED"],
  CUSTOMS_APPROVAL_REQUIRED: [
    "IMPORT_PERMITTED",
    "CUSTOMS_PACKAGE_READY",
    "NEEDS_REVIEW",
    "ESCALATED",
  ],
  IMPORT_PERMITTED: ["DELIVERY_ARRANGED", "ESCALATED"],
  DELIVERY_ARRANGED: ["DELIVERED", "ESCALATED"],
  DELIVERED: ["ARCHIVED"],
  ARCHIVED: [],
  ESCALATED: ["NEEDS_REVIEW", "WAITING_FOR_SUPPLIER", "ARCHIVED"],
};

export function isWorkflowState(value: string): value is WorkflowState {
  return (WORKFLOW_STATES as readonly string[]).includes(value);
}

export function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: WorkflowState, to: WorkflowState): void {
  if (!canTransition(from, to)) {
    throw new Error(`不正な状態遷移です: ${from} → ${to}`);
  }
}

// 進捗画面（仕様書§6.4）の10ステップと、各状態がどのステップに属するか
export const PROGRESS_STEPS: { label: string; states: WorkflowState[] }[] = [
  { label: "書類受領", states: ["DOCUMENTS_RECEIVING", "DOCUMENTS_RECEIVED"] },
  { label: "情報抽出", states: ["EXTRACTION_IN_PROGRESS", "EXTRACTION_COMPLETE"] },
  { label: "データ正規化", states: ["NORMALIZATION_COMPLETE"] },
  { label: "不足・不一致確認", states: ["VALIDATION_IN_PROGRESS", "NEEDS_REVIEW"] },
  { label: "輸出者修正対応", states: ["WAITING_FOR_SUPPLIER", "CORRECTION_RECEIVED"] },
  {
    label: "検疫提出準備",
    states: [
      "READY_FOR_QUARANTINE_PREPARATION",
      "QUARANTINE_DRAFT_READY",
      "QUARANTINE_APPROVAL_REQUIRED",
    ],
  },
  {
    label: "税関申告準備",
    states: [
      "READY_FOR_CUSTOMS_PREPARATION",
      "CUSTOMS_PACKAGE_READY",
      "CUSTOMS_APPROVAL_REQUIRED",
    ],
  },
  { label: "輸入許可", states: ["IMPORT_PERMITTED"] },
  { label: "納品", states: ["DELIVERY_ARRANGED", "DELIVERED"] },
  { label: "保存", states: ["ARCHIVED"] },
];

export function progressStepIndex(state: WorkflowState): number {
  const idx = PROGRESS_STEPS.findIndex((s) => s.states.includes(state));
  return idx === -1 ? 0 : idx;
}
