import { z } from "zod";

// Vue Data UI 的数据通常比较简洁，比如 Donut图就是简单的数组
const vueDataUiSchema = z.object({
  chart_type: z.enum(["VueUiDonut", "VueUiXy", "VueUiWaffle"]),
  title: z.string(),
  // 这里我们让 Agent 返回通用的 dataset，前端再根据 chart_type 适配
  dataset: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      series: z.array(z.number()).optional(), // 用于 XY 图表
      color: z.string().optional(),
    }),
  ),
  summary: z.string(),
});
