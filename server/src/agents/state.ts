import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// 定义 Agent 的“短期记忆”
export const AgentState = Annotation.Root({
  // 1. 对话历史 (必须)
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // 2. 最终产生的 UI 指令 (用于返回给前端)
  ui_instruction: Annotation<any>({
    reducer: (x, y) => y, // 覆盖更新，只保留最新的指令
    default: () => null,
  }),
  optimization_info: Annotation<{
    original: string;
    optimized: string;
    was_modified: boolean;
  } | null>({
    reducer: (x, y) => y,
    default: () => null,
  })
});
