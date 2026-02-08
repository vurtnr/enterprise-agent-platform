import { z } from "zod";
import { tool } from "@langchain/core/tools";

// --- 1. Dashboard 工具 ---
const dashboardSchema = z.object({
  view_type: z.enum(["COMPANY_OVERVIEW", "DEPT_DETAIL"]).describe("看板类型"),
  title: z.string().describe("看板标题"),
});

export const dashboardTool = tool(async ({ view_type, title }) => {
  // 模拟数据：未来这里会调用 Rust 计算模块
  const mockData = [
    { name: "Rust Core", value: 45, color: "#dea464" },
    { name: "Vue UI", value: 35, color: "#42b883" },
    { name: "Bun Server", value: 20, color: "#fbf3db" }
  ];

  return JSON.stringify({
    type: "UI_CMD",
    action: "RENDER_DASHBOARD",
    data: {
      chart_type: "VueUiDonut", // 指定使用 Vue Data UI 的甜甜圈图
      title: title,
      dataset: mockData
    },
    message: `已为您生成【${title}】的实时看板。`
  });
}, {
  name: "render_dashboard",
  description: "当用户想看数据汇总、大屏、驾驶舱或运营概况时使用。",
  schema: dashboardSchema
});

// --- 2. PPT 工具 ---
const pptSchema = z.object({
  topic: z.string().describe("PPT主题"),
  key_points: z.array(z.string()).describe("3个关键汇报点")
});

export const pptTool = tool(async ({ topic, key_points }) => {
  // 构造 Slidev 格式 Markdown
  const md = `
---
theme: seriph
background: https://source.unsplash.com/collection/94734566/1920x1080
---
# ${topic}
核心汇报点：
${key_points.map(p => `- ${p}`).join('\n')}
  `;

  return JSON.stringify({
    type: "UI_CMD",
    action: "RENDER_SLIDEV",
    data: { markdown: md },
    message: "演示文稿已生成，请点击查看。"
  });
}, {
  name: "generate_ppt",
  description: "当用户需要汇报、总结、演示或制作幻灯片时使用。",
  schema: pptSchema
});

// --- 3. Excel 工具 ---
const excelSchema = z.object({
  filename: z.string().describe("文件名"),
  row_count: z.number().describe("需要生成的行数")
});

export const excelTool = tool(async ({ filename, row_count }) => {
  // 构造 Univer Snapshot (简化版)
  const rows = Array.from({ length: row_count }, (_, i) => ({
    0: { v: `ID-${i+1}` },
    1: { v: `Item-${i+1}` },
    2: { v: Math.floor(Math.random() * 100) }
  }));
  
  const snapshot = {
    id: "sheet-01",
    sheets: {
      "sheet-1": {
        cellData: rows.reduce((acc, row, idx) => ({ ...acc, [idx]: row }), {})
      }
    }
  };

  return JSON.stringify({
    type: "UI_CMD",
    action: "RENDER_UNIVER",
    data: { snapshot, title: filename },
    message: "表格数据已准备就绪，支持在线编辑。"
  });
}, {
  name: "generate_spreadsheet",
  description: "当用户需要查明细、做表格时使用。注意：调用此工具后，只返回简短的确认语（如'表格已生成'），严禁在回复中用Markdown再次打印表格内容，严禁重复数据。",
  schema: excelSchema
});

export const allTools = [dashboardTool, pptTool, excelTool];