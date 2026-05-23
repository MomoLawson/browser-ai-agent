/**
 * settings — 用户设置（语言偏好）
 * 存储在 localStorage，在所有 AI 操作前读取
 */
const STORAGE_KEY = 'bai_settings'

export type Lang = 'auto' | 'zh-CN' | 'zh-TW' | 'en-US'

export interface Settings {
  language: Lang
}

const defaults: Settings = { language: 'auto' }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

/** 解析最终语言：auto → 浏览器语言 → 中文优先 → 英文回退 */
export function resolveLang(s: Settings): Lang {
  if (s.language !== 'auto') return s.language
  const nav = navigator.language || (navigator as any).userLanguage || ''
  if (nav.startsWith('zh-CN') || nav.startsWith('zh-Hans')) return 'zh-CN'
  if (nav.startsWith('zh-TW') || nav.startsWith('zh-Hant')) return 'zh-TW'
  return 'en-US'
}

/** 语言名称（用于设置界面） */
export const LANG_NAMES: Record<Lang, string> = {
  'auto': '🌐 自动 / Auto',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English (US)',
}

// ============================================================
// 提示词模板
// ============================================================

/**
 * 根据语言生成系统提示词。
 * 每个模板包含：
 *   - identity: AI 身份
 *   - thinking: 与用户交流的语言
 *   - tools: 可用工具说明
 *   - tool_format: 工具格式
 *   - rules: 规则
 */
export function buildSystemPrompt(name: string, lang: Lang): string {
  switch (lang) {
    case 'zh-CN': return zhCNSysPrompt(name)
    case 'zh-TW': return zhTWSysPrompt(name)
    default: return enUSSysPrompt(name)
  }
}

/** AgentLoop 中的工具执行反馈语言 */
export function toolFeedbackLang(lang: Lang): 'zh' | 'en' {
  return lang === 'en-US' ? 'en' : 'zh'
}

// ---- en-US ---------------------------------------------------

function enUSSysPrompt(name: string): string {
  return [
    '<system-reminder>',
    `[local-project: ${name}]`,
    '',
    'You have access to a local project folder through a browser agent. Use the following tool markers in your reply to operate files:',
    '',
    '[list]                List all project files',
    '[search: *.ts]        Search files by glob pattern',
    '[grep: keyword]       Search file contents',
    '[read: filepath]      Read a file',
    '[write: filepath]     Create a new file',
    '  file content here',
    '[/write]',
    '[edit: filepath]      Edit an existing file (read first)',
    '  code you want to replace',
    '  ====',
    '  new code',
    '[/edit]',
    '',
    'Rules:',
    '- [list] [read] [search] go directly in your reply text',
    '- [edit] [write] put inside a markdown code block (\\`\\`\\`)',
    '- [write] FAILS if file already exists → use [read]+[edit] instead',
    '- [edit] requires old code to EXACTLY match file content',
    '- [edit] separator is ==== (not ---, markdown renders --- as <hr>)',
    "- Do NOT re-read files you've already read this turn",
    '- Think and respond in English',
    '</system-reminder>',
  ].join('\n')
}

// ---- zh-CN ---------------------------------------------------

function zhCNSysPrompt(name: string): string {
  return [
    '<system-reminder>',
    `[local-project: ${name}]`,
    '',
    '你可以通过浏览器 Agent 操作本地项目文件。在回复中使用以下工具标记：',
    '',
    '[list]                列出所有项目文件',
    '[search: *.ts]        按文件名搜索 (glob)',
    '[grep: 关键词]        搜索文件内容',
    '[read: 文件路径]      读取文件',
    '[write: 文件路径]     创建新文件',
    '  文件内容',
    '[/write]',
    '[edit: 文件路径]      编辑已有文件（先用 read 确认）',
    '  要替换的代码',
    '  ====',
    '  替换后的代码',
    '[/edit]',
    '',
    '规则：',
    '- [list] [read] [search] 直接写在回复正文中',
    '- [edit] [write] 放在 markdown 代码块 \\`\\`\\` 内',
    '- [write] 文件已存在时会失败 → 改用 [read]+[edit]',
    '- [edit] 的旧代码必须与文件内容完全一致',
    '- edit 分隔符用 ==== 而不是 ---（---会被渲染为分割线）',
    '- 不要重复读取本轮已读过的文件',
    '- 用简体中文思考和回复',
    '</system-reminder>',
  ].join('\n')
}

// ---- zh-TW ---------------------------------------------------

function zhTWSysPrompt(name: string): string {
  return [
    '<system-reminder>',
    `[local-project: ${name}]`,
    '',
    '你可以透過瀏覽器 Agent 操作本地專案檔案。在回覆中使用以下工具標記：',
    '',
    '[list]                列出所有專案檔案',
    '[search: *.ts]        依檔名搜尋 (glob)',
    '[grep: 關鍵字]        搜尋檔案內容',
    '[read: 檔案路徑]      讀取檔案',
    '[write: 檔案路徑]     建立新檔案',
    '  檔案內容',
    '[/write]',
    '[edit: 檔案路徑]      編輯已有檔案（先用 read 確認）',
    '  要取代的程式碼',
    '  ====',
    '  取代後的程式碼',
    '[/edit]',
    '',
    '規則：',
    '- [list] [read] [search] 直接寫在回覆正文中',
    '- [edit] [write] 放在 markdown 程式碼區塊 \\`\\`\\` 內',
    '- [write] 檔案已存在時會失敗 → 改用 [read]+[edit]',
    '- [edit] 的舊程式碼必須與檔案內容完全一致',
    '- edit 分隔符用 ==== 而不是 ---（---會被渲染為分隔線）',
    '- 不要重複讀取本輪已讀過的檔案',
    '- 用繁體中文思考和回覆',
    '</system-reminder>',
  ].join('\n')
}

// ============================================================
// 工具执行反馈文案
// ============================================================

export function t(lang: Lang, key: string, ...args: string[]): string {
  const table = lang === 'en-US' ? EN_MSGS : lang === 'zh-TW' ? TW_MSGS : CN_MSGS
  let msg = table[key] || key
  args.forEach((a, i) => { msg = msg.replace(`{${i}}`, a) })
  return msg
}

const CN_MSGS: Record<string, string> = {
  waiting_project: '等待连接项目',
  project: '项目',
  files: '文件',
  prompt_send: '📋 发送提示词给 AI',
  fill_input: '📝 填入输入框',
  copy: '📋 复制',
  logs: '操作日志',
  clear: '清除',
  tool_list: '列出项目文件',
  tool_read: '读取 {0}',
  tool_write: '写入 {0}',
  tool_edit: '编辑 {0}',
  tool_search: '搜索文件 {0}',
  tool_grep: '搜索内容 {0}',
  executing_list: '📂 正在列出项目文件...',
  executed_list: '✅ 已列出 {0} 个文件',
  executing_read: '📖 正在读取: {0}',
  executed_read: '✅ 已读取 {0}（{1} 字符）',
  executing_write: '📝 正在创建: {0}',
  executed_write: '✅ 已创建 {0}',
  executing_edit: '✏️ 正在编辑: {0}',
  executed_edit: '✅ 已编辑 {0}',
  file_exists: '文件 {0} 已存在。请使用 [read] 读取后 [edit] 修改。',
}

const TW_MSGS: Record<string, string> = {
  waiting_project: '等待連接專案',
  project: '專案',
  files: '檔案',
  prompt_send: '📋 發送提示詞給 AI',
  fill_input: '📝 填入輸入框',
  copy: '📋 複製',
  logs: '操作日誌',
  clear: '清除',
  tool_list: '列出專案檔案',
  tool_read: '讀取 {0}',
  tool_write: '寫入 {0}',
  tool_edit: '編輯 {0}',
  tool_search: '搜尋檔案 {0}',
  tool_grep: '搜尋內容 {0}',
  executing_list: '📂 正在列出專案檔案...',
  executed_list: '✅ 已列出 {0} 個檔案',
  executing_read: '📖 正在讀取: {0}',
  executed_read: '✅ 已讀取 {0}（{1} 字元）',
  executing_write: '📝 正在建立: {0}',
  executed_write: '✅ 已建立 {0}',
  executing_edit: '✏️ 正在編輯: {0}',
  executed_edit: '✅ 已編輯 {0}',
  file_exists: '檔案 {0} 已存在。請用 [read] 讀取後以 [edit] 修改。',
}

const EN_MSGS: Record<string, string> = {
  waiting_project: 'Waiting for project',
  project: 'Project',
  files: 'files',
  prompt_send: '📋 Send prompt to AI',
  fill_input: '📝 Fill input',
  copy: '📋 Copy',
  logs: 'Logs',
  clear: 'Clear',
  tool_list: 'List project files',
  tool_read: 'Read {0}',
  tool_write: 'Write {0}',
  tool_edit: 'Edit {0}',
  tool_search: 'Search {0}',
  tool_grep: 'Grep {0}',
  executing_list: '📂 Listing project files...',
  executed_list: '✅ Listed {0} files',
  executing_read: '📖 Reading: {0}',
  executed_read: '✅ Read {0} ({1} chars)',
  executing_write: '📝 Creating: {0}',
  executed_write: '✅ Created {0}',
  executing_edit: '✏️ Editing: {0}',
  executed_edit: '✅ Edited {0}',
  file_exists: '{0} already exists. Use [read] then [edit] instead.',
}
