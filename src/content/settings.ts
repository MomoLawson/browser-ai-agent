/**
 * settings — 用户设置（语言偏好）
 * 存储在 localStorage，在所有 AI 操作前读取
 */
const STORAGE_KEY = 'bai_settings'

export type Lang = 'auto' | 'zh-CN' | 'zh-TW' | 'en-US'

export interface Settings {
  language: Lang
  webTools: boolean
}

const defaults: Settings = { language: 'auto', webTools: true }

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
const PROMPT_BODY = [
  '<system-reminder>',
  '[local-project: {name}]',
  '',
  'You have access to a local project folder through a browser agent. Use ONLY the following structured tool markers to operate files. Natural language requests (like "let me read the file") will NOT work — you MUST use the exact markers below:',
  '',
  '[list]                List all project files (must be on its own line)',
  '[search: *.ts]        Search files by glob pattern',
  '[grep: keyword]       Search file contents',
  '[read: filepath]      Read a file',
  '[write: filepath]     Create a new file (REQUIRES [/write] closing tag)',
  '  file content here',
  '[/write]',
  '[edit: filepath]      Edit an existing file (read first, REQUIRES [/edit] closing tag)',
  '  code you want to replace',
  '  ====',
  '  new code',
  '[/edit]',
  '[todo]                List all todos',
  '[todo: add "text"]    Add a todo',
  '[todo: done N]        Mark todo #N as done',
  '[todo: remove N]      Remove todo #N',
  '[todo: clear]         Clear all todos',
  '{web_tools}'  ,
  '[diagnose: filepath]  Run LSP diagnostics on a file (type errors, warnings)',
  '[skill: name]        View a skill\'s full content (see installed skills below)',
  '',
  'Rules:',
  '- [list] [todo] [read] [search] [grep] [diagnose] [skill] go DIRECTLY in your reply, NEVER in ``` code blocks',
  '- [edit] [write] put inside a markdown code block (```) with the marker as the language tag',
  '- [write] FAILS if file already exists → use [read]+[edit] instead',
  '- [edit] requires old code to EXACTLY match file content',
  '- [edit] separator is ==== (not ---, markdown renders --- as <hr>)',
  '- [write] [/write] and [edit] [/edit] MUST have closing tags or they will be ignored',
  "- Do NOT re-read files you've already read this turn",
  '- {think_dir}',
  '{skills}',
  '</system-reminder>',
]

const THINK_DIR: Record<Lang, string> = {
  'auto': 'Think and respond in English',
  'en-US': 'Think and respond in English',
  'zh-CN': 'Think and respond in Simplified Chinese',
  'zh-TW': 'Think and respond in Traditional Chinese',
}

export function buildSystemPrompt(name: string, lang: Lang, skillList?: string, webTools = true): string {
  const webLines = webTools
    ? '[search_web: query]   Search the web (use for external knowledge, up-to-date info)\n[fetch: https://...]  Fetch and read a web page\n\nIMPORTANT: The platform\'s built-in search has been disabled. You MUST use [search_web] for any web search. Do NOT ask the user to search manually.\n'
    : ''
  return PROMPT_BODY.map(line => line
    .replace('{name}', name)
    .replace('{think_dir}', THINK_DIR[lang] || THINK_DIR['en-US'])
    .replace('{skills}', skillList || '')
    .replace('{web_tools}', webLines)
  ).join('\n')
}

/** AgentLoop 中的工具执行反馈语言 */
export function toolFeedbackLang(lang: Lang): 'zh' | 'en' {
  return lang === 'en-US' ? 'en' : 'zh'
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
  project_connected: '项目已连接，Agent 开始监听',
  project_disconnected: '项目已断开',
  listening: '开始监听（跳过 {0} 条已有消息）',
  listening_stopped: '监听已停止',
  new_message: '检测到 AI 新消息',
  no_messages: '未检测到 AI 消息，监听中...',
  detected_tool: '检测到工具: {0}',
  tool_failed: '❌ 操作失败: {0}',
  perm_expired: '文件夹权限已失效，请重新选择项目',
  listing_files: '正在列出项目文件...',
  listed_files: '已列出 {0} 个文件',
  reading: '正在读取: {0}',
  read_done: '已读取 {0}（{1} 字符）',
  editing: '正在编辑: {0}',
  edited: '已编辑 {0}',
  creating: '正在创建: {0}',
  created: '已创建 {0}',
  searching: '搜索文件: {0}',
  found_files: '找到 {0} 个文件',
  grep_done: 'grep 完成',
  skill_loaded: '已加载技能: {0}',
  web_searching: '正在搜索: {0}',
  web_results: '找到 {0} 条结果',
  fetching: '正在获取: {0}',
  fetched: '已获取 {0} 字符',
  diagnosing: '正在诊断: {0}',
  diagnose_result: '{0}: {1} 个错误, {2} 个警告',
  diagnose_clean: '{0}: 无问题',
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
  project_connected: '專案已連接，Agent 開始監聽',
  project_disconnected: '專案已斷開',
  listening: '開始監聽（跳過 {0} 條已有消息）',
  listening_stopped: '監聽已停止',
  new_message: '偵測到 AI 新訊息',
  no_messages: '未偵測到 AI 訊息，監聽中...',
  detected_tool: '偵測到工具: {0}',
  tool_failed: '❌ 操作失敗: {0}',
  perm_expired: '資料夾權限已失效，請重新選擇專案',
  listing_files: '正在列出專案檔案...',
  listed_files: '已列出 {0} 個檔案',
  reading: '正在讀取: {0}',
  read_done: '已讀取 {0}（{1} 字元）',
  editing: '正在編輯: {0}',
  edited: '已編輯 {0}',
  creating: '正在建立: {0}',
  created: '已建立 {0}',
  searching: '搜尋檔案: {0}',
  found_files: '找到 {0} 個檔案',
  grep_done: 'grep 完成',
  skill_loaded: '已載入技能: {0}',
  web_searching: '正在搜尋: {0}',
  web_results: '找到 {0} 條結果',
  fetching: '正在獲取: {0}',
  fetched: '已獲取 {0} 字元',
  diagnosing: '正在診斷: {0}',
  diagnose_result: '{0}: {1} 個錯誤, {2} 個警告',
  diagnose_clean: '{0}: 無問題',
}

/**
 * 在 Shadow DOM 中渲染 Lucide 图标
 */
export function renderLucide(root: ShadowRoot): void {
  try {
    const l = (window as any).lucide
    if (l?.createIcons) l.createIcons({ root, attrs: { class: 'lui' } })
  } catch {}
}

// ---- 界面文本 ---------------------------------------------------

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
  project_connected: 'Project connected, agent listening',
  project_disconnected: 'Project disconnected',
  listening: 'Listening (skipped {0} existing messages)',
  listening_stopped: 'Listening stopped',
  new_message: 'New AI message detected',
  no_messages: 'No AI messages detected, listening...',
  detected_tool: 'Detected tool: {0}',
  tool_failed: '❌ Failed: {0}',
  perm_expired: 'Folder permission expired, re-select project',
  listing_files: 'Listing project files...',
  listed_files: 'Listed {0} files',
  reading: 'Reading: {0}',
  read_done: 'Read {0} ({1} chars)',
  editing: 'Editing: {0}',
  edited: 'Edited {0}',
  creating: 'Creating: {0}',
  created: 'Created {0}',
  searching: 'Searching files: {0}',
  found_files: 'Found {0} files',
  grep_done: 'Grep completed',
  skill_loaded: 'Loaded skill: {0}',
  web_searching: 'Searching web: {0}',
  web_results: 'Found {0} results',
  fetching: 'Fetching: {0}',
  fetched: 'Fetched {0} chars',
  diagnosing: 'Diagnosing: {0}',
  diagnose_result: '{0}: {1} error(s), {2} warning(s)',
  diagnose_clean: '{0}: no issues',
}
