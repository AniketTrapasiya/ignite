/**
 * components/workflows/nodes/index.ts
 * Export all custom node types for the React Flow builder.
 */
export { TriggerNode } from "./TriggerNode";
export { LLMNode } from "./LLMNode";
export { HTTPNode } from "./HTTPNode";
export { ConditionNode } from "./ConditionNode";
export { ActionNode } from "./ActionNode";
export { DelayNode } from "./DelayNode";
export { TransformNode } from "./TransformNode";
export { OutputNode } from "./OutputNode";

import { TriggerNode } from "./TriggerNode";
import { LLMNode } from "./LLMNode";
import { HTTPNode } from "./HTTPNode";
import { ConditionNode } from "./ConditionNode";
import { ActionNode } from "./ActionNode";
import { DelayNode } from "./DelayNode";
import { TransformNode } from "./TransformNode";
import { OutputNode } from "./OutputNode";

export const nodeTypes = {
  trigger: TriggerNode,
  llm: LLMNode,
  http: HTTPNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  transform: TransformNode,
  output: OutputNode,
};
