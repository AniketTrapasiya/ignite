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
export { ImageGenNode, VideoGenNode, AudioGenNode } from "./MediaNodes";

import { TriggerNode } from "./TriggerNode";
import { LLMNode } from "./LLMNode";
import { HTTPNode } from "./HTTPNode";
import { ConditionNode } from "./ConditionNode";
import { ActionNode } from "./ActionNode";
import { DelayNode } from "./DelayNode";
import { TransformNode } from "./TransformNode";
import { OutputNode } from "./OutputNode";
import { ImageGenNode, VideoGenNode, AudioGenNode } from "./MediaNodes";

export const nodeTypes = {
  trigger: TriggerNode,
  llm: LLMNode,
  http: HTTPNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  transform: TransformNode,
  output: OutputNode,
  image_gen: ImageGenNode,
  video_gen: VideoGenNode,
  audio_gen: AudioGenNode,
};
