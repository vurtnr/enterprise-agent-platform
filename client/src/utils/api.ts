// client/src/utils/api.ts
import { edenTreaty } from "@elysiajs/eden";
// 相对路径引用后端类型 (Monorepo 的优势)
import type { App } from "../../../server/src/index";

// 初始化强类型客户端
export const api = edenTreaty<App>("http://localhost:3000");
