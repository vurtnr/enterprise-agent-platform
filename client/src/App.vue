<script setup lang="ts">
import { ref, nextTick, onMounted, computed } from 'vue';
import DynamicRenderer from './components/DynamicRenderer.vue';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, breaks: true, linkify: true });

interface OptimizationInfo {
  original: string;
  optimized: string;
  was_modified: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
  isThinking?: boolean;
  ui?: any;
  optimization?: OptimizationInfo;
  statusText?: string;
}

interface ChatThread {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const NEW_CHAT_TITLE = '新对话';

const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatContainer = ref<HTMLElement | null>(null);

const chatThreads = ref<ChatThread[]>([
  {
    id: 'thread-1',
    title: '运营概览',
    preview: '查看运营大屏与核心指标',
    updatedAt: '今天',
    messages: [
      {
        role: 'assistant',
        content: '你好！我是企业智能助手。我可以帮你查看运营大屏、生成汇报 PPT，或者整理 Excel 数据表格。',
      },
    ],
  },
  {
    id: 'thread-2',
    title: '周报生成',
    preview: '整理本周转化与留存数据',
    updatedAt: '昨天',
    messages: [],
  },
  {
    id: 'thread-3',
    title: '增长分析',
    preview: '对比上周和本周的增长趋势',
    updatedAt: '3天前',
    messages: [],
  },
]);

const activeThreadId = ref(chatThreads.value[0]?.id ?? '');
const activeThread = computed(() =>
  chatThreads.value.find((thread) => thread.id === activeThreadId.value) ?? null,
);
chatHistory.value = chatThreads.value[0]?.messages ?? [];

const formatTimeLabel = () => {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const bumpThread = (id: string) => {
  const index = chatThreads.value.findIndex((item) => item.id === id);
  if (index <= 0) return;
  const [thread] = chatThreads.value.splice(index, 1);
  if (!thread) return;
  chatThreads.value.unshift(thread);
};

const setActiveThread = (id: string) => {
  const thread = chatThreads.value.find((item) => item.id === id);
  if (!thread) return;
  activeThreadId.value = id;
  chatHistory.value = thread.messages;
  scrollToBottom();
};

const createNewChat = () => {
  const id = `thread-${Date.now()}`;
  const thread: ChatThread = {
    id,
    title: NEW_CHAT_TITLE,
    preview: '新的对话',
    updatedAt: '刚刚',
    messages: [],
  };
  chatThreads.value.unshift(thread);
  setActiveThread(id);
};

const updateActiveThreadMeta = (text: string) => {
  const thread = activeThread.value;
  if (!thread) return;
  if (thread.title === NEW_CHAT_TITLE && text) {
    thread.title = text.slice(0, 12);
  }
  thread.preview = text.slice(0, 24);
  thread.updatedAt = formatTimeLabel();
  bumpThread(thread.id);
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const streamChatRequest = async (message: string) => {
  try {
    const response = await fetch('http://localhost:3000/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.statusText}`);
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const currentBotMsg = ref<ChatMessage>({
      role: 'assistant',
      content: '',
      thought: '',
      isThinking: false,
      ui: null,
      statusText: '正在优化指令并调度资源...',
    });
    const appendThought = (text: string) => {
      currentBotMsg.value.thought = (currentBotMsg.value.thought ?? '') + text;
    };
    chatHistory.value.push(currentBotMsg.value);
    await scrollToBottom();

    let buffer = '';
    let inThinkingBlock = false;
    let hasReceivedFirstToken = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.replace('data:', '').trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'opt') {
              currentBotMsg.value.statusText = '指令优化完成，正在生成内容...';

              if (data.data?.was_modified) {
                let lastUserMsg: ChatMessage | undefined;
                for (let i = chatHistory.value.length - 1; i >= 0; i -= 1) {
                  const msg = chatHistory.value[i];
                  if (!msg) continue;
                  if (msg.role === 'user') {
                    lastUserMsg = msg;
                    break;
                  }
                }
                if (lastUserMsg) lastUserMsg.optimization = data.data;
              }
            }

            if (data.type === 'token') {
              const token = data.content;
              buffer += token;

              if (!hasReceivedFirstToken && token.trim()) {
                hasReceivedFirstToken = true;
                currentBotMsg.value.statusText = '';
              }

              if (!inThinkingBlock && buffer.includes('<think>')) {
                inThinkingBlock = true;
                currentBotMsg.value.isThinking = true;
                const parts = buffer.split('<think>');
                const leading = parts[0] ?? '';
                if (leading) currentBotMsg.value.content += leading;
                buffer = parts[1] ?? '';
              }

              if (inThinkingBlock && buffer.includes('</think>')) {
                inThinkingBlock = false;
                currentBotMsg.value.isThinking = false;
                const parts = buffer.split('</think>');
                appendThought(parts[0] ?? '');
                buffer = parts[1] ?? '';
              } else {
                if (inThinkingBlock) {
                  appendThought(buffer);
                  buffer = '';
                } else if (!buffer.includes('<') || buffer.length > 20) {
                  currentBotMsg.value.content += buffer;
                  buffer = '';
                }
              }
              scrollToBottom();
            }

            if (data.type === 'ui') {
              currentBotMsg.value.ui = data.data;
              scrollToBottom();
            }
          } catch (e) {
            // ignore non-JSON payloads
          }
        }
      }
    }

    if (buffer) {
      if (inThinkingBlock) appendThought(buffer);
      else currentBotMsg.value.content += buffer;
    }

    currentBotMsg.value.isThinking = false;
    currentBotMsg.value.statusText = '';
  } catch (e: any) {
    console.error('Stream Failed:', e);
    chatHistory.value.push({ role: 'system', content: `请求中断: ${e.message}` });
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
};

const sendMessage = async () => {
  const text = userInput.value.trim();
  if (!text || loading.value) return;

  if (!activeThread.value) {
    createNewChat();
  }

  chatHistory.value.push({ role: 'user', content: text });
  updateActiveThreadMeta(text);
  userInput.value = '';
  loading.value = true;
  await scrollToBottom();

  await streamChatRequest(text);
};

onMounted(() => {
  const firstThread = chatThreads.value[0];
  if (firstThread) {
    setActiveThread(firstThread.id);
  }
});
</script>

<template>
  <div class="app-shell min-h-screen w-full font-body text-[var(--color-text)]">
    <div class="flex h-screen w-full">
      <aside
        class="flex h-full w-16 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]/95 px-2 py-4 transition-[width] duration-300 md:w-72 md:px-4"
      >
        <div class="flex items-center gap-3 px-2 md:px-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-2)]/20 text-xs font-semibold text-[var(--color-accent)] shadow-[0_0_20px_rgba(0,255,255,0.25)]"
          >
            EA
          </div>
          <div class="hidden md:block">
            <p class="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]">
              Enterprise
            </p>
            <p class="text-xs text-[var(--color-muted)]">Agent Platform</p>
          </div>
        </div>

        <button
          class="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium text-[var(--color-text)] shadow-[0_0_20px_rgba(123,97,255,0.18)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
          type="button"
          @click="createNewChat"
          aria-label="New Chat"
        >
          <span
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          >
            +
          </span>
          <span class="hidden md:inline">New Chat</span>
        </button>

        <div class="mt-6 px-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)] md:px-3">
          History
        </div>

        <nav class="mt-3 flex-1 space-y-2 overflow-y-auto px-1 pb-4 md:px-2">
          <button
            v-for="thread in chatThreads"
            :key="thread.id"
            type="button"
            class="group w-full rounded-xl border border-transparent px-2 py-2 text-left transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
            :class="
              activeThreadId === thread.id
                ? 'border-[var(--color-accent)] bg-[var(--color-surface-2)] shadow-[0_0_16px_rgba(0,255,255,0.18)]'
                : ''
            "
            @click="setActiveThread(thread.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="hidden text-xs font-semibold text-[var(--color-text)] md:inline md:text-sm">
                {{ thread.title }}
              </span>
              <span class="text-xs font-semibold text-[var(--color-text)] md:hidden">
                {{ thread.title.slice(0, 1) }}
              </span>
              <span class="hidden text-[10px] text-[var(--color-muted)] md:inline">{{ thread.updatedAt }}</span>
            </div>
            <p class="hidden text-xs text-[var(--color-muted)] md:block">
              {{ thread.preview }}
            </p>
          </button>
        </nav>
      </aside>

      <section class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-4 md:px-8"
        >
          <div class="flex flex-col">
            <span class="text-[10px] uppercase tracking-[0.3em] text-[var(--color-accent)]">Gemini Style</span>
            <h1 class="font-display text-lg text-[var(--color-text)] md:text-xl">Enterprise Agent Chat</h1>
          </div>
          <div class="hidden items-center gap-2 text-xs text-[var(--color-muted)] md:flex">
            <span
              class="h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_rgba(0,255,255,0.6)]"
            ></span>
            Streaming Ready
          </div>
        </header>

        <main ref="chatContainer" class="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div class="mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div
              v-if="chatHistory.length === 0"
              class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-6 py-8 text-center text-sm text-[var(--color-muted)] shadow-[0_0_20px_rgba(123,97,255,0.15)]"
            >
              <p class="font-display text-base text-[var(--color-text)]">Start a new conversation</p>
              <p class="mt-2">点击左侧 New Chat 或输入指令开始对话。</p>
            </div>

            <div v-for="(msg, idx) in chatHistory" :key="idx" class="flex flex-col gap-2">
              <div v-if="msg.role === 'user'" class="self-end flex max-w-[90%] flex-col items-end sm:max-w-[75%]">
                <div
                  class="rounded-2xl rounded-tr-none bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-[#050510] shadow-[0_0_20px_rgba(0,255,255,0.25)] md:text-base"
                >
                  {{ msg.content }}
                </div>
                <div
                  v-if="msg.optimization?.was_modified"
                  class="mt-2 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[11px] text-[var(--color-muted)]"
                >
                  <span class="font-semibold text-[var(--color-accent)]">指令已优化</span>
                  <span class="italic text-[var(--color-text)]">"{{ msg.optimization.optimized }}"</span>
                </div>
              </div>

              <div v-else-if="msg.role === 'assistant'" class="flex w-full max-w-5xl gap-3 md:gap-4">
                <div
                  class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-accent)] shadow-[0_0_16px_rgba(0,255,255,0.2)]"
                >
                  AI
                </div>

                <div class="flex min-w-0 flex-1 flex-col gap-3">
                  <div
                    v-if="msg.statusText && !msg.content && !msg.thought"
                    class="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-xs text-[var(--color-muted)] shadow-[0_0_16px_rgba(123,97,255,0.2)]"
                  >
                    <span class="relative flex h-2.5 w-2.5">
                      <span
                        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent-2)] opacity-70"
                      ></span>
                      <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]"></span>
                    </span>
                    <span class="font-medium">{{ msg.statusText }}</span>
                  </div>

                  <div v-if="msg.thought" class="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <details class="group" :open="msg.isThinking">
                      <summary
                        class="flex cursor-pointer items-center gap-2 bg-[var(--color-surface-2)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                      >
                        <div
                          v-if="msg.isThinking"
                          class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]"
                        ></div>
                        <div
                          v-else
                          class="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--color-success)] text-[10px] text-[var(--color-success)]"
                        >
                          OK
                        </div>
                        <span class="font-medium">{{ msg.isThinking ? '深度思考中...' : '已完成思考' }}</span>
                        <span class="ml-auto text-[10px] text-[var(--color-muted)] transition-transform group-open:rotate-180">▼</span>
                      </summary>
                      <div class="border-t border-[var(--color-border)] px-4 pb-3 pt-2 text-sm text-[var(--color-muted)]">
                        {{ msg.thought }}
                      </div>
                    </details>
                  </div>

                  <div
                    v-if="msg.content"
                    class="prose prose-invert max-w-none rounded-2xl rounded-tl-none border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-sm leading-relaxed text-[var(--color-text)] shadow-[0_0_20px_rgba(0,0,0,0.4)] md:text-base"
                    v-html="md.render(msg.content)"
                  ></div>

                  <DynamicRenderer v-if="msg.ui" :uiConfig="msg.ui" />
                </div>
              </div>

              <div v-else class="self-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] text-red-300">
                {{ msg.content }}
              </div>
            </div>
          </div>
        </main>

        <footer class="border-t border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-4 md:px-8">
          <div class="mx-auto flex w-full max-w-4xl items-center gap-3">
            <input
              v-model="userInput"
              @keyup.enter="sendMessage"
              type="text"
              :disabled="loading"
              placeholder="输入指令..."
              class="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] shadow-[0_0_16px_rgba(0,0,0,0.4)] transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              @click="sendMessage"
              :disabled="loading || !userInput.trim()"
              class="rounded-xl bg-[var(--color-cta)] px-5 py-3 text-sm font-semibold text-[#050510] shadow-[0_0_20px_rgba(255,0,255,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
            >
              发送
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  isolation: isolate;
}

.app-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(123, 97, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 120px 120px;
  opacity: 0.45;
  z-index: -1;
}

:deep(p) {
  margin-bottom: 0.6em;
}

:deep(p:last-child) {
  margin-bottom: 0;
}

:deep(pre) {
  background: #0b1024;
  padding: 0.85rem;
  border-radius: 0.6rem;
  overflow-x: auto;
  font-size: 0.9em;
  border: 1px solid rgba(39, 48, 79, 0.9);
}

:deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #7b61ff;
  background: rgba(123, 97, 255, 0.18);
  padding: 0.1rem 0.35rem;
  border-radius: 0.3rem;
}

:deep(pre code) {
  color: inherit;
  background: transparent;
  padding: 0;
}

:deep(ul) {
  list-style-type: disc;
  padding-left: 1.2rem;
}

:deep(ol) {
  list-style-type: decimal;
  padding-left: 1.2rem;
}

:deep(a) {
  color: #00ffff;
  text-decoration: underline;
}

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

main::-webkit-scrollbar {
  width: 6px;
}

main::-webkit-scrollbar-thumb {
  background-color: rgba(0, 255, 255, 0.35);
  border-radius: 999px;
}

main::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 255, 255, 0.55);
}
</style>
