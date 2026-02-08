import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { HumanMessage } from "@langchain/core/messages";
import { masterGraph } from "./agents/master";
// 引入 Rust 模块
import { calculateKpiGrowth } from "enterprise-core";

const app = new Elysia()
  .use(cors())
  .get("/", () => "Enterprise Agent Brain is Active 🧠 v2")

  // --- Agent 核心接口 ---
  .post(
    "/agent/chat",
    async ({ body }) => {
      const { message } = body;
      const inputs = { messages: [new HumanMessage(message)] };

      // 1. 运行图
      const finalState = await masterGraph.invoke(inputs);

      // 2. 提取结果
      // 此时 finalState.messages 是完整的历史
      // finalState.ui_instruction 是 Parser 节点提取好的干净数据
      const lastMsg = finalState.messages[finalState.messages.length - 1];

      return {
        reply: lastMsg.content,
        // 🔥 不需要在这里写 for 循环解析了，直接拿结果
        ui: finalState.ui_instruction,
        // 🔥 返回优化信息
        optimization: finalState.optimization_info
      };
    },
    {
      // 🔥 核心修正点在这里
      body: t.Object({
        message: t.String(),
        // 修正：使用 t.Optional() 包裹 t.Array()
        history: t.Optional(t.Array(t.Any())),
      }),
    },
  )

  .get("/test-rust", () => {
    return { result: calculateKpiGrowth(100.0, 50.0) };
  })
  .listen(3000);

console.log(`🦊 后端启动于: ${app.server?.hostname}:${app.server?.port}`);
console.log("Registered Routes:", app.routes.map(r => `${r.method} ${r.path}`));

export type App = typeof app;
