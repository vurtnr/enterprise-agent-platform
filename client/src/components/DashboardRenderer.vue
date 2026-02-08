<script setup lang="ts">
import { computed } from "vue";
import { VueUiDonut, VueUiXy, VueUiWaffle } from "vue-data-ui";

// 接收 Agent 返回的数据
const props = defineProps<{
    type: "VueUiDonut" | "VueUiXy" | "VueUiWaffle";
    data: any[];
    title: string;
}>();

// 预设配置 (前端控制样式，Agent控制数据) -> 保持 UI 统一性
const donutConfig = {
    style: {
        chart: {
            backgroundColor: "#FFFFFF",
            color: "#1A1A1A",
            layout: {
                labels: {
                    dataLabels: {
                        prefix: "",
                    },
                },
            },
        },
    },
};

const xyConfig = {
    chart: {
        padding: { top: 20, right: 20, bottom: 20, left: 20 },
        grid: { stroke: "#e1e5e8" },
    },
    bar: { borderRadius: 4, useGradient: true },
};

// 适配数据格式
const computedData = computed<any>(() => {
    if (props.type === "VueUiXy") {
        // VueUiXy 需要特定的 labels 和 series 结构，这里做简易适配
        return {
            labels: props.data.map((d) => d.name),
            series: [
                {
                    name: props.title,
                    data: props.data.map((d) => d.value),
                    type: "bar",
                    color: "#42d392",
                },
            ],
        };
    }
    // Donut 和 Waffle 通常直接接受数组对象
    return props.data;
});
</script>

<template>
    <div class="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
        <h3 class="text-lg font-bold text-gray-800 mb-4">{{ title }}</h3>

        <div class="h-64 w-full flex justify-center items-center">
            <VueUiDonut
                v-if="type === 'VueUiDonut'"
                :dataset="computedData"
                :config="donutConfig"
            />

            <VueUiXy
                v-if="type === 'VueUiXy'"
                :dataset="computedData"
                :config="xyConfig"
            />

            <VueUiWaffle
                v-if="type === 'VueUiWaffle'"
                :dataset="computedData"
                :config="{}"
            />
        </div>
    </div>
</template>
