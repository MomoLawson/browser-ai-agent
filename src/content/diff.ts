/**
 * diff — 简单行级 diff（LCS 算法），用于工具结果可视化
 */

export type DiffType = 'add' | 'del' | 'ctx'

export interface DiffLine {
  type: DiffType
  text: string
}

export interface DiffHunk {
  oldStart: number
  oldLen: number
  newStart: number
  newLen: number
  lines: DiffLine[]
}

/** 计算两个字符串的行级 diff */
export function computeDiff(oldStr: string, newStr: string): DiffHunk[] {
  const a = oldStr.split('\n')
  const b = newStr.split('\n')
  if (a.length === 0 && b.length === 0) return []

  // LCS DP
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrack → ops
  const ops: DiffLine[] = []
  let i = m, j = n
  const stack: DiffLine[] = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ type: 'ctx', text: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', text: b[j - 1] })
      j--
    } else {
      stack.push({ type: 'del', text: a[i - 1] })
      i--
    }
  }
  while (stack.length) ops.push(stack.pop()!)

  return groupHunks(ops)
}

/** 将 ops 分组为 hunk，每 hunk 前后带 contextLines 行上下文 */
function groupHunks(ops: DiffLine[], contextLines = 3): DiffHunk[] {
  const changeIdx = ops.map((l, i) => l.type !== 'ctx' ? i : -1).filter(i => i >= 0)
  if (changeIdx.length === 0) return []

  const hunks: DiffHunk[] = []
  let groupStart = changeIdx[0]
  let groupEnd = changeIdx[0]
  for (const ci of changeIdx.slice(1)) {
    if (ci - groupEnd <= contextLines * 2) {
      groupEnd = ci
    } else {
      hunks.push(buildHunk(ops, Math.max(0, groupStart - contextLines), Math.min(ops.length, groupEnd + contextLines + 1)))
      groupStart = ci
      groupEnd = ci
    }
  }
  hunks.push(buildHunk(ops, Math.max(0, groupStart - contextLines), Math.min(ops.length, groupEnd + contextLines + 1)))

  let oldLine = 0, newLine = 0
  for (const hunk of hunks) {
    let preDel = 0, preAdd = 0
    for (const l of hunk.lines) {
      if (l.type === 'del') preDel++
      else if (l.type === 'add') preAdd++
      else if (l.type === 'ctx') break
    }
    hunk.oldStart = Math.max(1, oldLine - preDel)
    hunk.newStart = Math.max(1, newLine - preAdd)
    hunk.oldLen = hunk.lines.filter(l => l.type !== 'add').length
    hunk.newLen = hunk.lines.filter(l => l.type !== 'del').length
    for (const l of hunk.lines) {
      if (l.type === 'ctx') { oldLine++; newLine++ }
      else if (l.type === 'del') oldLine++
      else if (l.type === 'add') newLine++
    }
  }
  return hunks
}

function buildHunk(ops: DiffLine[], start: number, end: number): DiffHunk {
  const lines = ops.slice(start, end)
  return { oldStart: 0, oldLen: 0, newStart: 0, newLen: 0, lines }
}

/** 将 hunk 格式化为 unified diff 文本 */
export function formatDiffText(hunks: DiffHunk[]): string {
  if (hunks.length === 0) return '(no changes)'
  const parts: string[] = []
  for (const h of hunks) {
    parts.push(`@@ -${h.oldStart},${h.oldLen} +${h.newStart},${h.newLen} @@`)
    for (const l of h.lines) {
      if (l.type === 'add') parts.push(`+${l.text}`)
      else if (l.type === 'del') parts.push(`-${l.text}`)
      else parts.push(` ${l.text}`)
    }
  }
  return parts.join('\n')
}
