#!/usr/bin/env node
/**
 * BAI Shell Server
 *
 * Lightweight local HTTP server for executing shell commands.
 * Used by Browser AI Agent to run builds, tests, and other commands.
 *
 * Usage:
 *   node server/server.js
 *   BAI_PORT=3939 BAI_CWD=/path/to/project node server/server.js
 */

const http = require('node:http')
const { exec } = require('node:child_process')
const path = require('node:path')

// ── Configuration ──────────────────────────────────────────────

const PORT = parseInt(process.env.BAI_PORT || '3939', 10)
const CWD = path.resolve(process.env.BAI_CWD || process.cwd())
const TIMEOUT = parseInt(process.env.BAI_TIMEOUT || '60000', 10)
const MAX_OUTPUT = 1024 * 1024 // 1 MB

// ── Help ───────────────────────────────────────────────────────

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
BAI Shell Server

Usage: node server/server.js [options]

Environment variables:
  BAI_PORT     Server port (default: 3939)
  BAI_CWD      Working directory (default: current directory)
  BAI_TIMEOUT  Command timeout in ms (default: 60000)

Options:
  --help, -h   Show this help
`)
  process.exit(0)
}

// ── Helpers ────────────────────────────────────────────────────

function readBody(req, limit = 10240) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
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

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// ── Request Handler ────────────────────────────────────────────

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'ok', cwd: CWD, port: PORT, timeout: TIMEOUT })
  }

  if (req.method === 'POST' && url.pathname === '/exec') {
    let body
    try { body = await readBody(req) }
    catch (e) { return json(res, 400, { error: e.message }) }

    const command = body.command
    if (!command || typeof command !== 'string') {
      return json(res, 400, { error: 'Missing or invalid "command" field' })
    }

    const cwd = body.cwd ? path.resolve(CWD, body.cwd) : CWD
    const timeout = Math.min(Math.max(body.timeout || TIMEOUT, 1000), 300000)

    const start = Date.now()

    return new Promise(resolve => {
      exec(command, {
        cwd,
        timeout,
        maxBuffer: MAX_OUTPUT,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' },
        shell: true,
      }, (error, stdout, stderr) => {
        const duration = Date.now() - start
        json(res, 200, {
          exitCode: error ? (error.code ?? 1) : 0,
          stdout: String(stdout || '').slice(0, MAX_OUTPUT),
          stderr: String(stderr || '').slice(0, MAX_OUTPUT),
          duration,
          signal: error?.signal || null,
        })
        resolve()
      })
    })
  }

  json(res, 404, { error: 'Not found' })
}

// ── Server ─────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('[BAI Server] Error:', err.message)
    if (!res.headersSent) json(res, 500, { error: 'Internal server error' })
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  BAI Shell Server')
  console.log('  ─────────────────')
  console.log(`  URL:     http://127.0.0.1:${PORT}`)
  console.log(`  CWD:     ${CWD}`)
  console.log(`  Timeout: ${TIMEOUT}ms`)
  console.log('')
  console.log('  Ready. Connect from the Browser AI Agent.')
  console.log('')
})

process.on('SIGINT', () => { console.log('\n[BAI Server] Shutting down...'); server.close(); process.exit(0) })
process.on('SIGTERM', () => { server.close(); process.exit(0) })
