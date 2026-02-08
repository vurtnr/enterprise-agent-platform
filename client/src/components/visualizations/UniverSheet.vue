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
let univerInstance: Univer | null = null;
let workbook: any = null;

const initUniver = async () => {
  // 等待 DOM 渲染，避免高度为 0
  await nextTick();
  if (!container.value) return;

  // 清理旧实例
  if (univerInstance) {
    univerInstance.dispose();
    univerInstance = null;
  }

  // 1. 初始化实例
  univerInstance = new Univer({
    theme: defaultTheme,
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: Tools.deepMerge(DesignZhCN, UIZhCN, SheetsUIZhCN),
    }
  });

  // 2. 注册插件
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

  // 3. 🔥🔥🔥 核心修复：强力数据清洗 🔥🔥🔥
  const rawData = toRaw(props.data) || {};
  
  // A. 确保 sheets 对象存在
  if (!rawData.sheets) rawData.sheets = {};

  // B. 获取所有真实的 sheet keys
  const realSheetKeys = Object.keys(rawData.sheets);

  // C. 如果没有任何 sheet，创建一个空的兜底，防止报错
  if (realSheetKeys.length === 0) {
    const fallbackId = 'sheet-01';
    rawData.sheets[fallbackId] = { name: 'Sheet1' };
    realSheetKeys.push(fallbackId);
  }

  // D. 重建 sheetOrder：强制使用真实的 Keys
  // 不管后端传了什么错的 order，我们只信 sheets 里的 key
  rawData.sheetOrder = realSheetKeys;

  // E. 补全默认属性 (行列数等)
  realSheetKeys.forEach(key => {
    const sheet = rawData.sheets[key];
    if (!sheet.rowCount) sheet.rowCount = 20;
    if (!sheet.columnCount) sheet.columnCount = 20;
    if (!sheet.id) sheet.id = key; // 确保内部 ID 一致
    if (!sheet.name) sheet.name = 'Data Sheet';
  });

  // F. 确保 Workbook ID 存在
  if (!rawData.id) rawData.id = 'workbook-01';

  // 4. 创建工作簿
  try {
    const snapshot = {
      appVersion: '3.0.0',
      name: props.title || 'Agent Sheet',
      locale: LocaleType.ZH_CN,
      ...rawData,
    };
    workbook = univerInstance.createUnit(UniverInstanceType.UNIVER_SHEET, snapshot);
  } catch (e) {
    console.error("Univer Create Unit Error:", e);
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
  <div class="univer-wrapper-component flex flex-col w-full h-full bg-white text-black relative">
    <div v-if="!data" class="absolute inset-0 flex items-center justify-center text-gray-400">
      Loading Data...
    </div>
    <div ref="container" class="flex-1 w-full h-full overflow-hidden"></div>
  </div>
</template>

<style scoped>
/* 样式隔离 */
.univer-wrapper-component :deep(*) {
  box-sizing: border-box;
}
</style>