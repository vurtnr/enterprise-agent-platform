import { StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { allTools } from "./tools";
import { optimizerNode } from "./optimizer";
import { SystemMessage } from "@langchain/core/messages";


// 1. 获取 Key
const apiKey = process.env.MINIMAX_API_KEY;

// 2. 强校验：如果没读到 Key，直接在启动时报错，不要等到请求时才崩
if (!apiKey) {
  console.error("🚨 严重错误: server/src/agents/master.ts 未找到 MINIMAX_API_KEY！");
  console.error("请检查 server/.env 文件是否存在且包含该变量。");
  throw new Error("Missing MINIMAX_API_KEY");
}

// 3. 初始化模型 (Master Brain)
const model = new ChatOpenAI({
  // 🔥 核心修正：必须显式传入 openAIApiKey
  openAIApiKey: apiKey, 
  
  configuration: {
    baseURL: "https://api.minimax.chat/v1",
  },
  modelName: "MiniMax-M2.1", // 保持和你 curl 测试一致
  temperature: 0.1,
}).bindTools(allTools);
// 2. 定义节点：思考 (LLM)
async function agentNode(state: typeof AgentState.State) {
  const { messages } = state;
  // 🔥 在每次思考前，插入一条 SystemMessage 提醒它
  const systemInstruction = new SystemMessage(
    "你是一个拥有GUI界面的智能体。当你调用工具（如Dashboard, Excel）生成界面时，请直接返回工具调用结果，不要在文本回复中重复描述数据，不要生成Markdown表格。保持回复简洁。"
  );
  const result = await model.invoke([systemInstruction, ...messages]);
  return { messages: [result] };
}

// 3. 定义节点：结果解析 (Parser)
// 当工具执行完，我们需要把 JSON 结果提取出来，存入 ui_instruction 状态
async function resultParserNode(state: typeof AgentState.State) {
  const { messages } = state;
  let detectedUI = null;

  // 倒序遍历，寻找最近的一次 UI 指令
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    // 场景 A: ToolMessage (工具直接返回的结果)
    if (msg instanceof ToolMessage) {
      try {
        const parsed = JSON.parse(msg.content as string);
        if (parsed.type === "UI_CMD") {
          detectedUI = parsed;
          break; // 找到了最近的一个，停止
        }
      } catch (e) {}
    }

    // 场景 B: AIMessage (有时候模型会把 JSON 包含在自己的回复里)
    // 某些模型可能会复述一遍 JSON，这里作为兜底
  }

  // 返回状态更新：这将自动合并到 AgentState 中
  return {
    ui_instruction: detectedUI,
  };
}

// 4. 构建条件边 (路由逻辑)
function shouldContinue(state: typeof AgentState.State) {
  const lastMsg = state.messages[state.messages.length - 1];

  // 如果模型想调用工具 -> 进入 tools 节点
  if (lastMsg.additional_kwargs?.tool_calls?.length) {
    return "tools";
  }
  // 否则直接结束 (纯聊天)
  return "__end__";
}

// 5. 构建图
const workflow = new StateGraph(AgentState)
  .addNode("optimizer", optimizerNode)
  .addNode("agent", agentNode)
  .addNode("tools", new ToolNode(allTools))
  .addNode("parser", resultParserNode) // 新增节点

  .addEdge("__start__", "optimizer")
  .addEdge("optimizer", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent") // 执行完工具回到 agent 做总结
  .addEdge("agent", "parser") // 🔥 关键：Agent 总结完，进入解析器
  .addEdge("parser", "__end__"); // 解析完，结束

export const masterGraph = workflow.compile();
