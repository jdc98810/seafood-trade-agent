// 状態遷移の唯一の実行入口。遷移白名单を検証し、必ず WorkflowEvent を記録する。

import { prisma } from "@/lib/db";
import {
  assertTransition,
  isWorkflowState,
  type WorkflowState,
} from "./state-machine";

export async function transitionShipment(
  shipmentId: string,
  toState: WorkflowState,
  actor: string,
  reason?: string
): Promise<void> {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  const fromState = shipment.status;
  if (!isWorkflowState(fromState)) {
    throw new Error(`未知の状態です: ${fromState}`);
  }
  if (fromState === toState) return;
  assertTransition(fromState, toState);

  await prisma.$transaction([
    prisma.shipment.update({ where: { id: shipmentId }, data: { status: toState } }),
    prisma.workflowEvent.create({
      data: { shipmentId, fromState, toState, actor, reason: reason ?? null },
    }),
  ]);
}

/** 遷移以外の操作（承認・草案生成など）も監査ログとして残す */
export async function recordEvent(
  shipmentId: string,
  toState: string,
  actor: string,
  reason: string
): Promise<void> {
  await prisma.workflowEvent.create({
    data: { shipmentId, fromState: null, toState, actor, reason },
  });
}
