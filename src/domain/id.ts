import type { NodeId, EdgeId, GroupId } from "@domain/types";

export const nodeId = (i: number) => `n-${i}` as unknown as NodeId;
export const edgeId = (i: number) => `e-${i}` as unknown as EdgeId;
export const groupId = (i: number) => `g-${i}` as unknown as GroupId;
