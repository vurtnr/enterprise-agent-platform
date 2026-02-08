<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, toRaw, nextTick } from 'vue';

// 引入 Univer 核心与插件
import { Univer, UniverInstanceType, LocaleType, Tools } from '@univerjs/core';
import { defaultTheme } from '@univerjs/design';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';

// 引入语言包
import DesignZhCN from '@univerjs/design/lib/locale/zh-CN';
import UIZhCN from '@univerjs/ui/lib/locale/zh-CN';
import SheetsUIZhCN from '@univerjs/sheets-ui/lib/locale/zh-CN';

// 引入样式
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";
import "@univerjs/sheets-ui/lib/index.css";

const props = defineProps<{
  data: any; 
  title: string;
}>();

const container = ref<HTMLElement | null>(null);
const isReady = ref(false); // 🔥 控制 Loading/Canvas 切换
let univerInstance: Univer | null = null;

const initUniver = async () => {
  if (!container.value) return;

  // 1. 重置状态
  if (univerInstance) {
    univerInstance.dispose();
    univerInstance = null;
  }
  isReady.value = false; // 先显示骨架屏

  // 确保 DOM 准备好
  await nextTick();

  // 2. 初始化 Univer 实例
  univerInstance = new Univer({
    theme: defaultTheme,
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: Tools.deepMerge(DesignZhCN, UIZhCN, SheetsUIZhCN),
    }
  });

  // 3. 注册插件
  univerInstance.registerPlugin(UniverRenderEnginePlugin);
  univerInstance.registerPlugin(UniverFormulaEnginePlugin);
  univerInstance.registerPlugin(UniverUIPlugin, {
    container: container.value,
    header: true,
    footer: true,
  });
  univerInstance.registerPlugin(UniverDocsPlugin, { hasScroll: false });
  univerInstance.registerPlugin(UniverDocsUIPlugin);
  univerInstance.registerPlugin(UniverSheetsPlugin);
  univerInstance.registerPlugin(UniverSheetsUIPlugin);
  univerInstance.registerPlugin(UniverSheetsFormulaPlugin);

  // 4. 🔥 数据清洗与补全 (防止白屏)
  const rawData = toRaw(props.data) || {};
  
  // 确保 sheets 对象存在
  if (!rawData.sheets) rawData.sheets = {};

  // 获取真实的 sheet keys
  const realSheetKeys = Object.keys(rawData.sheets);

  // 兜底：如果没有任何 sheet
  if (realSheetKeys.length === 0) {
    const fallbackId = 'sheet-01';
    rawData.sheets[fallbackId] = { name: 'Sheet1' };
    realSheetKeys.push(fallbackId);
  }

  // 强制重建 sheetOrder，确保与 sheets key 一致
  rawData.sheetOrder = realSheetKeys;

  // 补全默认属性
  realSheetKeys.forEach(key => {
    const sheet = rawData.sheets[key];
    if (!sheet.rowCount) sheet.rowCount = 20;
    if (!sheet.columnCount) sheet.columnCount = 20;
    if (!sheet.id) sheet.id = key;
    if (!sheet.name) sheet.name = 'Data Sheet';
  });

  if (!rawData.id) rawData.id = 'workbook-01';

  // 5. 创建工作簿
  try {
    const snapshot = {
      appVersion: '3.0.0',
      name: props.title || 'Agent Sheet',
      locale: LocaleType.ZH_CN,
      ...rawData,
    };
    univerInstance.createUnit(UniverInstanceType.UNIVER_SHEET, snapshot);
    
    // 🔥 6. 延迟显示：给 Canvas 一点渲染时间，避免闪白
    setTimeout(() => {
      isReady.value = true;
    }, 300);

  } catch (e) {
    console.error("Univer Init Error:", e);
  }
};

onMounted(() => {
  initUniver();
});

onBeforeUnmount(() => {
  if (univerInstance) {
    univerInstance.dispose();
  }
});

watch(() => props.data, () => {
  initUniver();
});
</script>

<template>
  <div class="univer-wrapper-component relative w-full h-[600px] bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col my-2 shadow-sm">
    
    <div 
      v-if="!isReady" 
      class="absolute inset-0 z-10 bg-slate-50 flex flex-col animate-pulse"
    >
      <div class="h-10 bg-slate-200 border-b border-slate-300 w-full mb-1"></div>
      <div class="h-6 bg-slate-200 w-full mb-4 opacity-50"></div>

      <div class="flex-1 p-4 space-y-4">
        <div class="flex gap-4">
           <div class="h-8 bg-slate-200 rounded w-20"></div>
           <div class="h-8 bg-slate-200 rounded w-1/4"></div>
           <div class="h-8 bg-slate-200 rounded w-1/4"></div>
        </div>
        <div class="h-8 bg-slate-200 rounded w-full opacity-80"></div>
        <div class="h-8 bg-slate-200 rounded w-full opacity-60"></div>
        <div class="h-8 bg-slate-200 rounded w-5/6 opacity-40"></div>
      </div>
      
      <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 font-medium bg-white/50 backdrop-blur-[1px]">
        <svg class="animate-spin mb-3 h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>渲染 Excel 引擎中...</span>
      </div>
    </div>

    <div 
      ref="container" 
      class="flex-1 w-full h-full transition-opacity duration-500 ease-in-out"
      :class="{ 'opacity-0': !isReady, 'opacity-100': isReady }"
    ></div>
  </div>
</template>

<style scoped>
/* 样式隔离：防止 Tailwind 全局样式影响 Univer 计算 */
.univer-wrapper-component :deep(*) {
  box-sizing: border-box;
}

/* 确保 Canvas 正确显示 */
.univer-wrapper-component :deep(canvas) {
  display: block;
}
</style>
