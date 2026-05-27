/**
 * LSP Core — 按需加载的轻量 LSP 管理器
 *
 * 设计原则：
 * - 按需加载：语言提供者仅在首次诊断时实例化
 * - 文件级别：不做项目级分析，只诊断单个文件
 * - 零依赖入口：core.ts 无外部依赖，语言提供者动态 import
 */

// ============================================================
// 类型
// ============================================================

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

export interface Diagnostic {
  line: number        // 1-based
  column: number      // 1-based
  endLine?: number
  endColumn?: number
  severity: DiagnosticSeverity
  message: string
  code?: string | number
  source?: string     // e.g. 'typescript', 'python'
}

export interface CodeAction {
  title: string
  diagnostics: Diagnostic[]
  newText: string
  startLine: number
  startCol: number
  endLine: number
  endCol: number
}

export interface DiagnosticResult {
  filePath: string
  diagnostics: Diagnostic[]
  actions: CodeAction[]
  /** 格式化为 AI 可读文本 */
  toText(): string
}

export interface LspProvider {
  /** 该提供者支持的文件扩展名 */
  extensions: string[]
  /** 诊断单个文件 */
  diagnose(filePath: string, content: string): Promise<DiagnosticResult>
  /** 清理资源 */
  dispose?(): void
}

// ============================================================
// 结果实现
// ============================================================

export function createResult(filePath: string, diagnostics: Diagnostic[], actions: CodeAction[] = []): DiagnosticResult {
  return {
    filePath,
    diagnostics,
    actions,
    toText() {
      if (diagnostics.length === 0) return `[Diagnose] ${filePath}: no issues found`
      const errors = diagnostics.filter(d => d.severity === 'error').length
      const warnings = diagnostics.filter(d => d.severity === 'warning').length
      const summary = `[Diagnose] ${filePath}: ${errors} error(s), ${warnings} warning(s)`
      const lines = diagnostics.map(d => {
        const sev = d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️' : 'ℹ️'
        const loc = `L${d.line}:${d.column}`
        const code = d.code ? ` [${d.code}]` : ''
        return `  ${sev} ${loc}${code} ${d.message}`
      })
      return [summary, ...lines].join('\n')
    },
  }
}

// ============================================================
// 管理器（按需加载）
// ============================================================

type ProviderFactory = () => Promise<LspProvider>

const _factories = new Map<string, ProviderFactory>()
const _providers = new Map<string, LspProvider>()

// 注册语言提供者工厂
function register(exts: string[], factory: ProviderFactory): void {
  for (const ext of exts) _factories.set(ext, factory)
}

// 预注册（懒加载）
register(['.ts', '.tsx'], async () => {
  const mod = await import('./typescript')
  return mod.createTypeScriptProvider()
})

register(['.js', '.jsx', '.mjs', '.cjs'], async () => {
  const mod = await import('./typescript')
  return mod.createJavaScriptProvider()
})

register(['.py'], async () => {
  const mod = await import('./python')
  return mod.createPythonProvider()
})

function getExt(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : ''
}

/**
 * 获取文件对应的 LspProvider（首次调用时按需加载）
 */
export async function getProvider(filePath: string): Promise<LspProvider | null> {
  const ext = getExt(filePath)
  if (!ext) return null

  // 已加载的提供者
  if (_providers.has(ext)) return _providers.get(ext)!

  // 查找工厂并加载
  const factory = _factories.get(ext)
  if (!factory) return null

  const provider = await factory()
  // 同扩展名共享实例
  const targetExts = provider.extensions
  for (const e of targetExts) {
    if (!_providers.has(e)) _providers.set(e, provider)
  }
  return provider
}

/**
 * 对文件运行诊断
 */
export async function diagnose(filePath: string, content: string): Promise<DiagnosticResult | null> {
  const provider = await getProvider(filePath)
  if (!provider) return null
  return provider.diagnose(filePath, content)
}

/**
 * 格式化诊断结果供 AI 读取
 */
export function formatDiagnosticsForAI(result: DiagnosticResult | null): string {
  if (!result) return ''
  if (result.diagnostics.length === 0) return ''
  return '\n\n' + result.toText()
}

/**
 * 释放所有提供者资源
 */
export function disposeAll(): void {
  for (const p of _providers.values()) p.dispose?.()
  _providers.clear()
}
