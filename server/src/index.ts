// server/src/index.ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
// ❌ 不再需要 @elysiajs/stream，我们用原生的
// import { Stream } from "@elysiajs/stream"; 
import { HumanMessage } from "@langchain/core/messages";
import { masterGraph } from "./agents/master";
import { calculateKpiGrowth } from "enterprise-core";

const app = new Elysia()
  .use(cors())
  .get("/", () => "Enterprise Agent Brain [V3] - READY 🧠")

  // 🔥🔥🔥 核弹级修复：使用原生 Response 接管流 🔥🔥🔥
  .post("/agent/chat", async ({ body }) => {
    const { message, history } = body;
    console.log("🌊 [Start] 收到 SSE 请求:", message);

    // 1. 创建原生可读流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // 辅助函数：写入 SSE 格式数据
        const sendSSE = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            // 控制器可能已关闭
          }
        };

        // 心跳保活
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch (e) {
            clearInterval(heartbeat);
          }
        }, 3000);

        try {
          const inputs = {
            messages: [new HumanMessage(message)],
          };

          const eventStream = await masterGraph.streamEvents(inputs, {
            version: "v2",
          });

          for await (const event of eventStream) {
            // A. 文本流
            if (event.event === "on_chat_model_stream") {
              const chunk = event.data.chunk;
              if (chunk && chunk.content) {
                sendSSE({ type: "token", content: chunk.content });
              }
            }
            
            // B. 优化器
            if (event.event === "on_chain_end" && event.name === "optimizer") {
              const output = event.data.output;
              if (output?.optimization_info) {
                sendSSE({ type: "opt", data: output.optimization_info });
              }
            }

            // C. UI 指令
            if (event.event === "on_chain_end" && event.name === "parser") {
              const output = event.data.output;
              if (output?.ui_instruction) {
                sendSSE({ type: "ui", data: output.ui_instruction });
              }
            }
          }

          sendSSE({ type: "done" });
          
          // 🔥 必须显式关闭流
          controller.close();

        } catch (error: any) {
          console.error("🚨 Stream Logic Error:", error);
          sendSSE({ type: "token", content: `\n\n> ❌ **系统异常**: ${error.message}` });
          sendSSE({ type: "done" });
          controller.close();
        } finally {
          clearInterval(heartbeat);
        }
      }
    });

    // 2. 返回原生 Response，强制覆盖 Header
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  }, {
    body: t.Object({
      message: t.String(),
      history: t.Optional(t.Array(t.Any())),
    }),
  })
  
  .get("/test-rust", () => {
    return { result: calculateKpiGrowth(100.0, 50.0) };
  })
  .listen(3000);

console.log(`🦊 后端启动于: ${app.server?.hostname}:${app.server?.port}`);
export type App = typeof app;