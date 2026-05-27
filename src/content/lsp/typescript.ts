/**
 * TypeScript / JavaScript LSP Provider
 *
 * 基础语法检查（零外部依赖）。
 * Extension 模式下可通过 background script 使用完整 TypeScript 编译器。
 */
import type { LspProvider, Diagnostic, DiagnosticResult } from './core'
import { createResult } from './core'

function basicSyntaxCheck(filePath: string, content: string, lang: 'ts' | 'js'): DiagnosticResult {
  const diags: Diagnostic[] = []
  const lines = content.split('\n')

  // --- 括号匹配 ---
  const stack: Array<{ ch: string; line: number; col: number }> = []
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const closers = new Set(Object.values(pairs))
  let lineNum = 1, col = 1
  let inStr: string | null = null, inTemplate = false, escape = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (escape) { escape = false; col++; continue }
    if (ch === '\\') { escape = true; col++; continue }

    if (inStr) {
      if (ch === inStr) inStr = null
      if (ch === '\n') { lineNum++; col = 1 } else col++
      continue
    }
    if (inTemplate) {
      if (ch === '`') inTemplate = false
      if (ch === '\n') { lineNum++; col = 1 } else col++
      continue
    }

    if (ch === '"' || ch === "'") { inStr = ch; col++; continue }
    if (ch === '`') { inTemplate = true; col++; continue }

    if (ch === '/' && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i)
      if (nl === -1) break
      lineNum++; col = 1; i = nl; continue
    }
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2)
      const block = content.slice(i, end === -1 ? content.length : end + 2)
      lineNum += (block.match(/\n/g) || []).length
      i = end === -1 ? content.length - 1 : end + 1
      col = 1; continue
    }

    if (pairs[ch]) stack.push({ ch, line: lineNum, col })
    else if (closers.has(ch)) {
      const top = stack.pop()
      if (!top) diags.push({ line: lineNum, column: col, severity: 'error', message: `Unmatched '${ch}'`, source: `${lang}-syntax` })
      else if (pairs[top.ch] !== ch) diags.push({ line: lineNum, column: col, severity: 'error', message: `Expected '${pairs[top.ch]}' but found '${ch}'`, source: `${lang}-syntax` })
    }

    if (ch === '\n') { lineNum++; col = 1 } else col++
  }
  for (const u of stack) diags.push({ line: u.line, column: u.col, severity: 'error', message: `Unclosed '${u.ch}'`, source: `${lang}-syntax` })

  // --- 常见问题扫描 ---
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue

    if (/\bvar\s+/.test(t)) {
      diags.push({ line: i + 1, column: lines[i].indexOf('var') + 1, severity: 'info', message: "Use 'let' or 'const' instead of 'var'", source: `${lang}-lint` })
    }
    const eqMatch = t.match(/[^!=<>]==(?!=)/)
    if (eqMatch) {
      diags.push({ line: i + 1, column: (lines[i].indexOf('==') ?? 0) + 1, severity: 'info', message: "Use '===' instead of '=='", source: `${lang}-lint` })
    }
    if (lines[i].length > 120) {
      diags.push({ line: i + 1, column: 121, severity: 'info', message: `Line too long (${lines[i].length} > 120)`, source: `${lang}-lint` })
    }
    // console.log in production code
    if (/\bconsole\.(log|debug)\b/.test(t)) {
      diags.push({ line: i + 1, column: lines[i].indexOf('console') + 1, severity: 'hint', message: 'console.log/debug left in code', source: `${lang}-lint` })
    }
  }

  return createResult(filePath, diags)
}

function makeProvider(extensions: string[], lang: 'ts' | 'js'): LspProvider {
  return {
    extensions,
    async diagnose(filePath, content) {
      return basicSyntaxCheck(filePath, content, lang)
    },
  }
}

export const createTypeScriptProvider = () => makeProvider(['.ts', '.tsx'], 'ts')
export const createJavaScriptProvider = () => makeProvider(['.js', '.jsx', '.mjs', '.cjs'], 'js')
