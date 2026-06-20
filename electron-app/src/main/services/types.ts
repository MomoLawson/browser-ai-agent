import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * 服务状态（返回给渲染进程）
 */
export interface ServiceStatus {
  id: string           // 内部标识 (如 'shell')
  name: string         // 显示名称 (如 'Shell')
  enabled: boolean
  running: boolean
  info?: string        // 额外信息（如 cwd、端口等）
  error?: string
}

/**
 * HTTP 请求上下文（解析后的 body）
 */
export interface RouteContext {
  req: IncomingMessage
  res: ServerResponse
  body: any
}

/**
 * 路由处理器
 */
export type RouteHandler = (ctx: RouteContext) => Promise<void> | void

/**
 * BAI 服务接口 — 所有功能模块都实现此接口
 *
 * 每个 Service 可以注册自己的 HTTP 路由，
 * 由统一的 HTTP Server 根据注册情况分发请求。
 */
export interface BAIAppService {
  /** 服务标识名 (如 'shell', 'lsp', 'git') */
  name: string

  /** 显示名称 */
  displayName: string

  /** 当前是否启用 */
  enabled: boolean

  /** 启动服务 */
  start(): Promise<void>

  /** 停止服务 */
  stop(): Promise<void>

  /**
   * 注册 HTTP 路由
   * 返回 route map: { 'GET /health': handler, 'POST /exec': handler, ... }
   */
  getRoutes(): Record<string, RouteHandler>

  /** 获取服务状态 */
  getStatus(): ServiceStatus
}
