<script setup lang="ts">
defineProps<{ markdown: string }>();
</script>

<template>
  <div class="slidev-mock w-full h-full bg-white rounded flex flex-col items-center justify-center p-8">
    <h3 class="text-2xl font-bold mb-4">PPT 预览模式</h3>
    <div class="prose max-w-none w-full bg-gray-100 p-4 rounded text-left whitespace-pre-wrap font-mono text-sm">
      {{ markdown }}
    </div>
    <p class="mt-4 text-gray-400 text-sm">实际项目中，这里会集成 Slidev 或 Reveal.js 进行渲染。</p>
  </div>
</template>