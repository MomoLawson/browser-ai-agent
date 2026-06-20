import { exec, type ChildProcess, type ExecException } from 'node:child_process'
import path from 'node:path'
import type { BAIAppService, ServiceStatus, RouteHandler, RouteContext } from './types'

const MAX_OUTPUT = 1024 * 1024  // 1 MB

/**
 * Shell 服务 — 执行 shell 命令
 *
 * 复用 server/server.js 的核心逻辑，实现 BAIAppService 接口。
 * 路由: GET /health, POST /exec
 */
export class ShellService implements BAIAppService {
  name = 'shell'
  displayName = 'Shell'
  enabled = true

  private cwd: string
  private timeout: number
  private running = false
  private logCallback: ((msg: string) => void) | null = null

  constructor(options?: { cwd?: string; timeout?: number }) {
    this.cwd = path.resolve(options?.cwd || process.cwd())
    this.timeout = options?.timeout || 60000
  }

  /** 设置日志回调（发送到渲染进程） */
  onLog(callback: (msg: string) => void): void {
    this.logCallback = callback
  }

  async start(): Promise<void> {
    this.running = true
    this.log(`Shell service started (cwd: ${this.cwd})`)
  }

  async stop(): Promise<void> {
    this.running = false
    this.log('Shell service stopped')
  }

  getStatus(): ServiceStatus {
    return {
      id: this.name,
      name: this.displayName,
      enabled: this.enabled,
      running: this.running,
      info: this.running ? `cwd: ${this.cwd}` : undefined,
    }
  }

  /** 更新工作目录 */
  setCwd(cwd: string): void {
    this.cwd = path.resolve(cwd)
    this.log(`Shell cwd updated: ${this.cwd}`)
  }

  getRoutes(): Record<string, RouteHandler> {
    return {
      'GET /health': (ctx) => this.handleHealth(ctx),
      'POST /exec': (ctx) => this.handleExec(ctx),
    }
  }

  private handleHealth(ctx: RouteContext): void {
    const { res } = ctx
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      cwd: this.cwd,
      port: 3939,
      timeout: this.timeout,
    }))
  }

  private async handleExec(ctx: RouteContext): Promise<void> {
    const { res, body } = ctx

    const command = body?.command
    if (!command || typeof command !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing or invalid "command" field' }))
      return
    }

    const cwd = body.cwd ? path.resolve(this.cwd, body.cwd) : this.cwd
    const timeout = Math.min(Math.max(body.timeout || this.timeout, 1000), 300000)

    this.log(`$ ${command}`)

    const start = Date.now()

    const result = await new Promise<{
      exitCode: number
      stdout: string
      stderr: string
      duration: number
      signal: string | null
    }>((resolve) => {
      const options = {
        cwd,
        timeout,
        maxBuffer: MAX_OUTPUT,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' },
        shell: '/bin/sh',
      }
      exec(command, options, (error: ExecException | null, stdout: string, stderr: string) => {
        const duration = Date.now() - start
        resolve({
          exitCode: error ? (error.code ?? 1) : 0,
          stdout: String(stdout || '').slice(0, MAX_OUTPUT),
          stderr: String(stderr || '').slice(0, MAX_OUTPUT),
          duration,
          signal: (error as any)?.signal || null,
        })
      })
    })

    const durationSec = (result.duration / 1000).toFixed(2)
    if (result.exitCode === 0) {
      this.log(`✓ exit 0 (${durationSec}s)`)
    } else {
      this.log(`✗ exit ${result.exitCode} (${durationSec}s)`)
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  }

  private log(msg: string): void {
    const ts = new Date().toLocaleTimeString()
    const line = `[${ts}] [Shell] ${msg}`
    console.log(line)
    this.logCallback?.(line)
  }
}
