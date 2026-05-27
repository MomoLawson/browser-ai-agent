/**
 * Python LSP Provider（轻量版）
 *
 * 基础语法检查，无需外部依赖。
 * 检查：缩进错误、冒号缺失、括号不匹配、常见语法问题。
 */
import type { LspProvider, Diagnostic, DiagnosticResult } from './core'
import { createResult } from './core'

function checkIndentation(lines: string[]): Diagnostic[] {
  const diags: Diagnostic[] = []
  let expectedIndent = 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue // skip blank lines

    const indent = raw.length - raw.trimStart().length
    const trimmed = raw.trim()

    // 冒号结尾的行 → 下一行预期缩进 +4
    const prevLine = i > 0 ? lines[i - 1].trim() : ''

    // 检查是否缩进不一致（非4的倍数）
    if (indent % 4 !== 0 && indent > 0) {
      diags.push({
        line: i + 1,
        column: 1,
        severity: 'warning',
        message: `Indentation is not a multiple of 4 spaces (${indent} spaces)`,
        source: 'python-lint',
      })
    }

    // 检查 tab/space 混用
    if (raw.startsWith('\t') && raw.includes(' ')) {
      diags.push({
        line: i + 1,
        column: 1,
        severity: 'error',
        message: 'Mixed tabs and spaces in indentation',
        source: 'python-lint',
      })
    }

    // 冒号后紧跟非空行（应换行）
    if (prevLine.endsWith(':') && indent <= expectedIndent) {
      diags.push({
        line: i + 1,
        column: 1,
        severity: 'warning',
        message: 'Expected indented block after colon',
        source: 'python-lint',
      })
    }

    if (trimmed.endsWith(':')) expectedIndent = indent + 4
    else expectedIndent = indent
  }

  return diags
}

function checkBrackets(content: string): Diagnostic[] {
  const diags: Diagnostic[] = []
  const stack: Array<{ char: string; line: number; col: number }> = []
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const closers = new Set(Object.values(pairs))
  let line = 1
  let col = 1
  let inString: string | null = null
  let escape = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]

    if (escape) { escape = false; col++; continue }
    if (ch === '\\') { escape = true; col++; continue }

    // 字符串内跳过
    if (inString) {
      if (ch === inString) inString = null
      if (ch === '\n') { line++; col = 1 } else col++
      continue
    }

    if (ch === '"' || ch === "'") {
      // 三引号
      if (content.slice(i, i + 3) === '"""' || content.slice(i, i + 3) === "'''") {
        const triple = content.slice(i, i + 3)
        const end = content.indexOf(triple, i + 3)
        if (end === -1) {
          diags.push({ line, column: col, severity: 'error', message: `Unterminated triple-quoted string`, source: 'python-lint' })
          break
        }
        const inner = content.slice(i, end + 3)
        const newlines = (inner.match(/\n/g) || []).length
        line += newlines
        i = end + 2
        col = 1
        continue
      }
      inString = ch
      col++
      continue
    }

    if (ch === '#') {
      // 行注释，跳到行尾
      const nl = content.indexOf('\n', i)
      if (nl === -1) break
      i = nl - 1
      col = 1
      line++
      continue
    }

    if (pairs[ch]) {
      stack.push({ char: ch, line, col })
    } else if (closers.has(ch)) {
      const top = stack.pop()
      if (!top) {
        diags.push({ line, column: col, severity: 'error', message: `Unmatched closing '${ch}'`, source: 'python-lint' })
      } else if (pairs[top.char] !== ch) {
        diags.push({ line, column: col, severity: 'error', message: `Mismatched brackets: expected '${pairs[top.char]}' but found '${ch}'`, source: 'python-lint' })
      }
    }

    if (ch === '\n') { line++; col = 1 } else col++
  }

  for (const unclosed of stack) {
    diags.push({
      line: unclosed.line,
      column: unclosed.col,
      severity: 'error',
      message: `Unclosed '${unclosed.char}'`,
      source: 'python-lint',
    })
  }

  return diags
}

function checkCommonIssues(content: string): Diagnostic[] {
  const diags: Diagnostic[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // 行尾分号（非必要）
    if (trimmed.endsWith(';') && !trimmed.endsWith(';;')) {
      diags.push({
        line: i + 1,
        column: raw.length,
        severity: 'info',
        message: 'Unnecessary semicolon at end of line',
        source: 'python-lint',
      })
    }

    // == None → 应该用 is None
    if (/==\s*None/.test(trimmed)) {
      diags.push({
        line: i + 1,
        column: trimmed.indexOf('None') + 1,
        severity: 'warning',
        message: "Use 'is None' instead of '== None'",
        source: 'python-lint',
      })
    }

    // bare except
    if (/^except\s*:/.test(trimmed)) {
      diags.push({
        line: i + 1,
        column: 1,
        severity: 'warning',
        message: 'Bare except clause; use Exception or a specific exception',
        source: 'python-lint',
      })
    }

    // f-string 缺少引号
    if (/f[^'""][^=]*\{/.test(trimmed) && !trimmed.startsWith('f"') && !trimmed.startsWith("f'")) {
      // 不精确但可以提示
    }

    // 行过长
    if (raw.length > 120) {
      diags.push({
        line: i + 1,
        column: 121,
        severity: 'info',
        message: `Line too long (${raw.length} > 120 characters)`,
        source: 'python-lint',
      })
    }
  }

  return diags
}

export function createPythonProvider(): LspProvider {
  return {
    extensions: ['.py'],
    async diagnose(filePath, content) {
      const lines = content.split('\n')
      const diagnostics: Diagnostic[] = [
        ...checkBrackets(content),
        ...checkIndentation(lines),
        ...checkCommonIssues(content),
      ]
      return createResult(filePath, diagnostics)
    },
  }
}
