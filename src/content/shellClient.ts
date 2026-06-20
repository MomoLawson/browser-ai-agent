/**
 * shellClient — 与本地 BAI Shell Server 通信
 *
 * 通过 HTTP 请求与 localhost 上运行的 Shell Server 交互，
 * 让 Agent 能执行 shell 命令（build、test、git 等）。
 */

export interface ShellResult {
  exitCode: number
  stdout: string
  stderr: string
  duration: number
  signal: string | null
}

export interface ShellHealth {
  status: string
  cwd: string
  port: number
  timeout: number
}

const DEFAULT_URL = 'http://127.0.0.1:3939'

/** 检查 Shell Server 是否在线 */
export async function checkShellServer(baseUrl?: string): Promise<ShellHealth | null> {
  const url = (baseUrl || DEFAULT_URL).replace(/\/+$/, '')
  try {
    const resp = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

/** 执行 shell 命令 */
export async function execShellCommand(
  command: string,
  options?: { timeout?: number; baseUrl?: string }
): Promise<ShellResult> {
  const url = (options?.baseUrl || DEFAULT_URL).replace(/\/+$/, '')
  const timeout = options?.timeout || 60000

  let resp: Response
  try {
    resp = await fetch(`${url}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 10000),
    })
  } catch {
    throw new Error(
      'Cannot connect to Shell Server. Start the BAI Desktop App.'
    )
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => null)
    throw new Error(body?.error || `Server error: ${resp.status}`)
  }

  return await resp.json()
}
