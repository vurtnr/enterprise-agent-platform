// server/src/agents/optimizer.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { AgentState } from "./state";

// 使用轻量级或相同的模型
const optimizerModel = new ChatOpenAI({
  configuration: { baseURL: "https://api.deepseek.com/v1" },
  apiKey: process.env.DEEPSEEK_API_KEY,
  modelName: "deepseek-reasoner",
  temperature: 0.2, // 稍微有点创造力，但不要胡编
});

// 系统提示词：教会 AI 如何做一个“企业级指令翻译官”
const SYSTEM_PROMPT = `你是一个专业的企业数据助手 Prompt 优化专家。
你的任务是将用户模糊、简短的输入，改写为精准、详细的指令，以便下游的 AI Agent 能更好地调用工具。

你需要了解下游 Agent 拥有以下三种能力：
1. Dashboard (数据大屏/驾驶舱)：适合查看"概况"、"趋势"、"监控"、"大盘"。
2. PPT (演示文稿)：适合"汇报"、"总结"、"会议材料"。
3. Excel (电子表格)：适合"明细"、"记录"、"导出"、"编辑数据"。

优化规则：
1. 补全缺失的主语和时间状语（默认为当前时间/全公司范围）。
2. 根据动词推断最合适的工具场景（例如："整理一下" -> Excel，"给老板看" -> PPT）。
3. 如果用户输入已经很清晰，请原样返回，不要画蛇添足。
4. 保持简洁，不要解释，直接输出优化后的 Prompt。

示例：
输入："销售"
输出："请帮我生成一个销售数据驾驶舱，展示本月全公司的销售业绩概况。"

输入："把昨天的异常数据拉出来"
输出："请帮我生成一份Excel表格，列出昨天所有的异常检测数据明细。"

输入："我要开会讲下质量问题"
输出："请生成一份关于质量问题的汇报PPT，重点分析近期的主要质量缺陷。"
`;

export async function optimizerNode(state: typeof AgentState.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  
  // 只处理用户的文本消息
  if (typeof lastMessage.content !== "string") {
    return {};
  }

  const originalInput = lastMessage.content;

  // 调用 LLM 进行改写
  const response = await optimizerModel.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(`用户输入: "${originalInput}"\n优化后的指令:`)
  ]);

  const optimizedInput = response.content as string;

  // 判断是否真的改写了 (简单的长度或内容比较)
  const wasModified = optimizedInput.length > originalInput.length + 5 || optimizedInput !== originalInput;

  if (wasModified) {
    console.log(`✨ Prompt Optimized: ${originalInput} -> ${optimizedInput}`);
    
    // 🔥 关键操作：我们不替换历史，而是追加一条 SystemMessage 或者直接替换最后一条 HumanMessage 的内容
    // 这里我们选择替换最后一条消息的内容，让 Master Agent 以为用户就是这么问的
    // 但我们在 optimization_info 里保留原始记录
    
    // 注意：LangGraph 的 Immutability，我们需要返回一个新的 messages 数组来更新
    // 这里的逻辑是：把最后一条消息替换掉
    const newMessages = [...messages];
    newMessages[newMessages.length - 1] = new HumanMessage(optimizedInput);

    return {
      messages: newMessages,
      optimization_info: {
        original: originalInput,
        optimized: optimizedInput,
        was_modified: true
      }
    };
  }

  return {
    optimization_info: {
      original: originalInput,
      optimized: originalInput,
      was_modified: false
    }
  };
}