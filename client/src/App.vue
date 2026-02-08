<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import DynamicRenderer from './components/DynamicRenderer.vue';
import MarkdownIt from 'markdown-it';

// 初始化 Markdown 解析器 (关闭 HTML 标签以防 XSS)
const md = new MarkdownIt({ html: false, breaks: true, linkify: true });

// --- 类型定义 ---
interface OptimizationInfo {
  original: string;
  optimized: string;
  was_modified: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;         // 最终回答 (Markdown)
  thought?: string;        // 思考过程 (折叠区)
  isThinking?: boolean;    // 是否正在生成思考
  ui?: any;                // UI 组件配置 (Excel/PPT/Dashboard)
  optimization?: OptimizationInfo; // 提示词优化信息
  statusText?: string;     // 🔥 细粒度状态 (用于首字等待期的提示)
}

// --- 状态变量 ---
const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// 🔥 核心：原生 Fetch 流式请求处理
const streamChatRequest = async (message: string) => {
  try {
    // 1. 发起 POST 请求
    const response = await fetch("http://localhost:3000/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.statusText}`);
    if (!response.body) return;

    // 2. 准备流读取器
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    // 3. 创建 Assistant 消息占位
    const currentBotMsg = ref<ChatMessage>({
      role: 'assistant',
      content: '',
      thought: '',
      isThinking: false, 
      ui: null,
      optimization: null,
      // 🔥 初始状态：给用户即时反馈，消除焦虑
      statusText: '正在优化指令并调度资源...' 
    });
    chatHistory.value.push(currentBotMsg.value);
    await scrollToBottom();

    // 4. 流解析状态机
    let buffer = ""; 
    let inThinkingBlock = false;
    let hasReceivedFirstToken = false; // 标记：是否已开始吐字

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // 处理 SSE 格式 (可能会有粘包，按行分割)
      const lines = chunk.split("\n");

      for (const line of lines) {
        // 只处理 data: 开头的行
        if (line.startsWith("data:")) {
          const jsonStr = line.replace("data:", "").trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          
          try {
            const data = JSON.parse(jsonStr);

            // Type A: 提示词优化信息
            if (data.type === "opt") {
              currentBotMsg.value.statusText = '指令优化完成，正在生成内容...';
              
              if (data.data?.was_modified) {
                 // 回填到上一条 User 消息
                 const lastUserMsg = chatHistory.value.findLast(m => m.role === 'user');
                 if (lastUserMsg) lastUserMsg.optimization = data.data;
              }
            }

            // Type B: 文本 Token
            if (data.type === "token") {
              const token = data.content;
              buffer += token;

              // 🔥 收到第一个 Token，说明 LLM 真正开始输出了，清除 Loading 状态
              if (!hasReceivedFirstToken && token.trim()) {
                hasReceivedFirstToken = true;
                currentBotMsg.value.statusText = ''; 
              }
              
              // --- <think> 标签解析逻辑 ---
              // 1. 检测开始标签
              if (!inThinkingBlock && buffer.includes("<think>")) {
                inThinkingBlock = true;
                currentBotMsg.value.isThinking = true;
                const parts = buffer.split("<think>");
                if (parts[0]) currentBotMsg.value.content += parts[0]; // 标签前的内容归正文
                buffer = parts[1] || "";
              }

              // 2. 检测结束标签
              if (inThinkingBlock && buffer.includes("</think>")) {
                inThinkingBlock = false;
                currentBotMsg.value.isThinking = false;
                const parts = buffer.split("</think>");
                currentBotMsg.value.thought += parts[0]; // 标签前的内容归思考
                buffer = parts[1] || "";
              } else {
                // 3. 普通追加
                if (inThinkingBlock) {
                  currentBotMsg.value.thought += buffer;
                  buffer = ""; 
                } else {
                  // 防御性追加：避免截断 Markdown 符号或标签
                  // 只有当 buffer 不包含 '<' (可能是标签头) 或者 buffer 够长时才上屏
                  if (!buffer.includes("<") || buffer.length > 20) {
                    currentBotMsg.value.content += buffer;
                    buffer = "";
                  }
                }
              }
              scrollToBottom();
            }

            // Type C: UI 指令
            if (data.type === "ui") {
              currentBotMsg.value.ui = data.data;
              scrollToBottom();
            }

          } catch (e) {
            // 忽略心跳包或非 JSON 数据
          }
        }
      }
    }
    
    // 5. 扫尾：处理缓冲区剩余内容
    if (buffer) {
        if (inThinkingBlock) currentBotMsg.value.thought += buffer;
        else currentBotMsg.value.content += buffer;
    }
    
    // 确保最终状态正确
    currentBotMsg.value.isThinking = false;
    currentBotMsg.value.statusText = ''; 

  } catch (e: any) {
    console.error("Stream Failed:", e);
    chatHistory.value.push({ role: 'system', content: `请求中断: ${e.message}` });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
};

// 发送入口
const sendMessage = async () => {
  const text = userInput.value.trim();
  if (!text || loading.value) return;

  chatHistory.value.push({ role: 'user', content: text });
  userInput.value = '';
  loading.value = true;
  await scrollToBottom();

  await streamChatRequest(text);
};

onMounted(() => {
  chatHistory.value.push({
    role: 'assistant',
    content: '你好！我是企业智能助手。我可以帮你查看运营大屏、生成汇报 PPT，或者整理 Excel 数据表格。'
  });
});
</script>

<template>
  <div class="flex h-screen w-full flex-col bg-slate-50 font-sans">
    
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
      <div class="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold shadow-blue-200">EA</div>
      <div>
        <h1 class="font-bold text-slate-800 text-lg leading-tight">Enterprise Agent Platform</h1>
        <p class="text-xs text-slate-500">Bun + Rust + Vue3 + Stream + Markdown</p>
      </div>
    </header>

    <main ref="chatContainer" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
      <div v-for="(msg, idx) in chatHistory" :key="idx" class="flex flex-col gap-2 transition-all duration-300">
        
        <div v-if="msg.role === 'user'" class="self-end flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
          <div class="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-md text-sm sm:text-base">
            {{ msg.content }}
          </div>
          <div v-if="msg.optimization?.was_modified" class="mt-1.5 mr-1 text-xs text-slate-400 flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
            <span class="text-yellow-600">✨ 指令已优化:</span>
            <span class="italic text-slate-600">"{{ msg.optimization.optimized }}"</span>
          </div>
        </div>

        <div v-else-if="msg.role === 'assistant'" class="self-start w-full max-w-5xl flex gap-3 sm:gap-4 animate-fade-in-up">
          <div class="w-9 h-9 bg-white border border-slate-200 rounded-full flex-shrink-0 flex items-center justify-center text-lg shadow-sm">🤖</div>
          
          <div class="flex-1 flex flex-col gap-3 min-w-0">
            
            <div v-if="msg.statusText && !msg.content && !msg.thought" class="flex items-center gap-2 text-slate-500 text-sm bg-slate-100 px-4 py-2 rounded-xl w-fit border border-slate-200 shadow-sm transition-all">
               <span class="relative flex h-2.5 w-2.5">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
               </span>
               <span class="font-medium animate-pulse">{{ msg.statusText }}</span>
            </div>

            <div v-if="msg.thought" class="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <details class="group" :open="msg.isThinking">
                <summary class="flex items-center gap-2 px-4 py-2 cursor-pointer text-slate-500 hover:text-slate-700 text-xs select-none transition-colors bg-slate-100/50">
                  <div v-if="msg.isThinking" class="w-3.5 h-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500"></div>
                  <div v-else class="w-3.5 h-3.5 text-green-500 flex items-center justify-center font-bold">✓</div>
                  <span class="font-medium">{{ msg.isThinking ? '深度思考中...' : '已完成思考' }}</span>
                  <span class="text-slate-300 ml-auto text-[10px] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div class="px-4 pb-3 pt-2 text-slate-500 text-sm leading-relaxed whitespace-pre-wrap border-t border-slate-200 italic bg-slate-50 font-mono text-[13px]">
                  {{ msg.thought }}
                </div>
              </details>
            </div>

            <div 
              v-if="msg.content" 
              class="bg-white px-5 py-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 text-slate-700 text-sm sm:text-base leading-relaxed prose prose-sm max-w-none prose-slate"
              v-html="md.render(msg.content)"
            >
            </div>
            
            <DynamicRenderer v-if="msg.ui" :uiConfig="msg.ui" />
          </div>
        </div>

        <div v-else class="self-center bg-red-50 text-red-600 text-xs px-3 py-1 rounded-full border border-red-100 my-2">
          ⚠️ {{ msg.content }}
        </div>
      </div>
    </main>

    <footer class="p-4 bg-white border-t border-slate-200">
      <div class="max-w-4xl mx-auto flex gap-3 relative">
        <input 
          v-model="userInput" 
          @keyup.enter="sendMessage" 
          type="text" 
          :disabled="loading" 
          placeholder="输入指令..." 
          class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed placeholder:text-slate-400" 
        />
        <button 
          @click="sendMessage" 
          :disabled="loading || !userInput.trim()" 
          class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-md disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* 简单的 Markdown 样式补丁 (配合 Tailwind Typography) */
:deep(p) { margin-bottom: 0.5em; }
:deep(p:last-child) { margin-bottom: 0; }
:deep(pre) { background: #f1f5f9; padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.9em; border: 1px solid #e2e8f0; }
:deep(code) { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #e11d48; background: #fff1f2; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
:deep(pre code) { color: inherit; background: transparent; padding: 0; }
:deep(ul) { list-style-type: disc; padding-left: 1.2rem; }
:deep(ol) { list-style-type: decimal; padding-left: 1.2rem; }
:deep(a) { color: #2563eb; text-decoration: underline; }

/* 动画 */
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }

/* 滚动条 */
main::-webkit-scrollbar { width: 6px; }
main::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 3px; }
main::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
</style>