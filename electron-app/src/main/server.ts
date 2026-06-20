import http from 'node:http'
import { registry } from './services/registry'

const PORT = 3939
const MAX_BODY = 10240

let server: http.Server | null = null

/**
 * 读取请求 body（JSON）
 */
function readBody(req: http.IncomingMessage, limit = MAX_BODY): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) { reject(new Error('Body too large')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

/**
 * 发送 JSON 响应
 */
function json(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/**
 * 处理请求
 */
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

  // 全局路由: GET /status — 返回所有服务状态
  if (req.method === 'GET' && url.pathname === '/status') {
    json(res, 200, { services: registry.getStatuses() })
    return
  }

  // 从 service registry 查找路由
  const handler = registry.matchRoute(req.method || 'GET', url.pathname)
  if (handler) {
    const body = req.method === 'POST' ? await readBody(req).catch(() => null) : null
    await handler({ req, res, body })
    return
  }

  json(res, 404, { error: 'Not found' })
}

/**
 * 启动 HTTP Server
 */
export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      handleRequest(req, res).catch(err => {
        console.error('[Server] Error:', err.message)
        if (!res.headersSent) json(res, 500, { error: 'Internal server error' })
      })
    })

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[Server] Listening on http://127.0.0.1:${PORT}`)
      resolve()
    })

    server.on('error', (err) => {
      console.error('[Server] Failed to start:', err.message)
      reject(err)
    })
  })
}

/**
 * 停止 HTTP Server
 */
export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) { resolve(); return }
    server.close(() => { server = null; resolve() })
  })
}
