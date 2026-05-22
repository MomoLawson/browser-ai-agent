import type { AgentMessageType as _AgentMessageType } from '../shared/types'

/**
 * Userscript 模式入口包装器
 *
 * 当 Chrome Extension 未安装时，Userscript 需要在页面上下文中
 * 自行处理所有逻辑。此文件提供额外的包装逻辑。
 *
 * 注意：vite-plugin-monkey 已自动处理大多数 Userscript 兼容性。
 * 此文件用于额外的配置和扩展点。
 */

// 可以直接 import 内容脚本入口
// vite-plugin-monkey 会自动处理入口文件的打包
export {}
