<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { api } from './utils/api';
import DynamicRenderer from './components/DynamicRenderer.vue';

// 定义消息类型接口
interface OptimizationInfo {
  original: string;
  optimized: string;
  was_modified: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ui?: any; // 存储后端返回的 UI 指令 (Univer/Dashboard/PPT)
  optimization?: OptimizationInfo; // 存储优化信息
}

const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);

// 自动滚动到底部
const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const sendMessage = async () => {
  const text = userInput.value.trim();
  if (!text || loading.value) return;

  // 1. 立即上屏用户消息
  chatHistory.value.push({ role: 'user', content: text });
  userInput.value = '';
  loading.value = true;
  await scrollToBottom();

  try {
    // 2. 调用后端 Agent
    // 注意：这里利用了 Eden 的类型推导，参数和返回值都是类型安全的
    const { data, error } = await api.agent.chat.post({
      message: text,
      // 实际项目中可以传递历史上下文: history: chatHistory.value.map(...)
    });

    if (error) {
      throw new Error(error.status === 500 ? '服务器内部错误' : '请求失败');
    }

    if (data) {
      // 3. 处理提示词优化信息 (回填到上一条用户消息中)
      // 如果后端真的对提示词做了修改，我们在界面上提示用户
      if (data.optimization && data.optimization.was_modified) {
        const lastUserMsg = chatHistory.value.findLast(m => m.role === 'user');
        if (lastUserMsg) {
          lastUserMsg.optimization = data.optimization;
        }
      }

      // 4. 上屏 AI 回复 (包含文本和可能的 UI 组件)
      chatHistory.value.push({
        role: 'assistant',
        content: data.reply,
        ui: data.ui 
      });
    }
  } catch (e: any) {
    console.error(e);
    chatHistory.value.push({ 
      role: 'system', 
      content: `系统繁忙或出错: ${e.message || '未知错误'}` 
    });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
};

// 页面加载时的欢迎语
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
      <div class="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold shadow-blue-200">
        EA
      </div>
      <div>
        <h1 class="font-bold text-slate-800 text-lg leading-tight">Enterprise Agent Platform</h1>
        <p class="text-xs text-slate-500">Bun + Rust + Vue3 工业级架构</p>
      </div>
    </header>

    <main ref="chatContainer" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
      <div v-for="(msg, idx) in chatHistory" :key="idx" class="flex flex-col gap-2 transition-all duration-300">
        
        <div v-if="msg.role === 'user'" class="self-end flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
          <div class="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-md text-sm sm:text-base">
            {{ msg.content }}
          </div>
          
          <div v-if="msg.optimization?.was_modified" class="mt-1.5 mr-1 text-xs text-slate-400 flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
            <span class="text-yellow-600">✨ AI 已优化指令:</span>
            <span class="italic text-slate-600">"{{ msg.optimization.optimized }}"</span>
          </div>
        </div>

        <div v-else-if="msg.role === 'assistant'" class="self-start w-full max-w-5xl flex gap-3 sm:gap-4 animate-fade-in-up">
          <div class="w-9 h-9 bg-white border border-slate-200 rounded-full flex-shrink-0 flex items-center justify-center text-lg shadow-sm">
            🤖
          </div>
          
          <div class="flex-1 flex flex-col gap-3 min-w-0">
            <div class="bg-white px-5 py-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
              {{ msg.content }}
            </div>

            <DynamicRenderer 
              v-if="msg.ui" 
              :uiConfig="msg.ui" 
            />
          </div>
        </div>

        <div v-else class="self-center bg-red-50 text-red-600 text-xs px-3 py-1 rounded-full border border-red-100 my-2">
          ⚠️ {{ msg.content }}
        </div>

      </div>

      <div v-if="loading" class="self-start flex items-center gap-2 text-slate-400 text-sm ml-14 py-2">
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
        </span>
        Agent 正在思考并调度工具...
      </div>
    </main>

    <footer class="p-4 bg-white border-t border-slate-200">
      <div class="max-w-4xl mx-auto flex gap-3 relative">
        <input 
          v-model="userInput" 
          @keyup.enter="sendMessage"
          type="text" 
          :disabled="loading"
          placeholder="输入指令，例如：生成一份不锈钢检测报表..." 
          class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed placeholder:text-slate-400"
        />
        <button 
          @click="sendMessage"
          :disabled="loading || !userInput.trim()"
          class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>发送</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
      <div class="max-w-4xl mx-auto text-center mt-2">
         <p class="text-[10px] text-slate-400">Powered by MiniMax & LangGraph</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* 简单的进入动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out forwards;
}

/* 自定义滚动条样式 */
main::-webkit-scrollbar {
  width: 6px;
}
main::-webkit-scrollbar-track {
  background: transparent;
}
main::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 3px;
}
main::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}
</style>