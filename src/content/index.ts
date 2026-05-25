/**
 * Browser AI Agent — 主入口
 *
 * 让 AI 网站拥有操作本地文件的能力，类似 opencode/claude code。
 *
 * 工作流：
 * 1. 页面右下角 🤖 → 打开面板 → 选择项目
 * 2. 面板显示提示词 → 用户复制到输入框 → 发送给 AI
 * 3. AI 知道能力 → Agent 监听对话 → 自动执行工具
 */
import { detectPlatform, getPlatformDisplayName } from './platforms/detector'
import { TriggerButton } from './ui/TriggerButton'
import { AgentPanel } from './ui/AgentPanel'
import { AgentLoop } from './agentLoop'
import type { FileEntry } from '../shared/types'
import { selectProjectFolder, readDirectoryStructure, readFile, writeFile, verifyPermission, countFiles } from './fileSystem'
import { saveHandle, saveProjectName } from './handleStore'
import { fillInput, appendToInput, simulateSend } from './injectUtils'
import { loadSettings, resolveLang, buildSystemPrompt, t, type Lang } from './settings'
import { registerExtensionHandler } from './extension-handler'

let dirHandle: FileSystemDirectoryHandle | null = null
let trigger: TriggerButton | null = null
let panel: AgentPanel | null = null
let agent: AgentLoop | null = null
let projectName = ''



function main(): void {
  const platform = detectPlatform()
  if (!platform) { console.log('[BAI] 不支持'); return }
  console.log(`[BAI] 检测到 ${getPlatformDisplayName(platform)}`)
  const tryInject = (n=8) => {
    if (document.body) { createTrigger(); return }
    if (n>0) setTimeout(()=>tryInject(n-1),1500)
  }
  setTimeout(()=>tryInject(),800)
}

function createTrigger(): void {
  trigger?.destroy()
  trigger = new TriggerButton(() => { trigger?.hide(); openPanel() })
}

async function openPanel(): Promise<void> {
  panel?.destroy()
  panel = new AgentPanel()

  // 如果项目仍在连接中，恢复面板状态
  if (dirHandle && projectName) {
    panel!.setProjectInfo(projectName, 0)
    panel!.setStatus('listening', '')
    panel!.addLog('info', `Project: ${projectName}`)
    const prompt = buildPrompt(projectName)
    panel!.showPrompt(prompt)
  }

  // 提示词复制到输入框
  panel!.onSendPrompt = (text: string) => {
    fillInput(text)
    panel!.addLog('success', 'Prompt filled into input')
    setTimeout(() => {
      const sent = simulateSend()
      if (sent) {
        panel!.addLog('success', 'Prompt sent to AI')
      } else {
        panel!.addLog('warn', 'Could not auto-send, please press Enter')
      }
    }, 300)
  }

  panel!.onSelectProject = async () => {
    const r = await selectProjectFolder()
    if (!r) return null
    dirHandle = r.handle; projectName = r.name
    await saveHandle(r.handle); saveProjectName(r.name)
    const tree = await readDirectoryStructure(r.handle)
    afterProjectConnected()
    return { name: r.name, fileCount: countFiles(tree) }
  }

  panel!.onClose = () => { panel?.destroy(); panel=null; trigger?.show() }
}

function afterProjectConnected(): void {
  if (!dirHandle || !panel) return

  // 生成提示词
  const prompt = buildPrompt(projectName)
  panel.showPrompt(prompt)
  panel.addLog('success', `Project connected: ${projectName}`)
  panel.addLog('info', 'Copy the prompt and send it to AI')
  panel.setStatus('listening', '')

  startAgentLoop()
}

function countCurrentAIMessages(): number {
  let c = 0
  c += document.querySelectorAll('[data-message-author-role="assistant"]').length
  if (c === 0) c += document.querySelectorAll('.ds-assistant-message-main-content, [class*="assistant-message"]').length
  if (c === 0) c += document.querySelectorAll('ms-chat-turn').length
  return c
}

let _currentLang: Lang = 'en-US'
export function currentLang(): Lang { return _currentLang }

function buildPrompt(name: string): string {
  const s = loadSettings()
  _currentLang = resolveLang(s)
  return buildSystemPrompt(name, _currentLang)
}

function startAgentLoop(): void {
  if (!dirHandle || !panel) return
  agent?.stop()
  agent = new AgentLoop({
    lang: _currentLang,
    getConversation: async () => {
      const ms: Array<{role:string;content:string}> = []
      document.querySelectorAll('[data-message-author-role]').forEach(el => {
        const r = el.getAttribute('data-message-author-role')||''
        const c = el.textContent||''; if(c.trim()) ms.push({role:r,content:c})
      })
      if (ms.length===0) {
        document.querySelectorAll('[data-testid="user-message"]').forEach(el=>{const c=el.textContent||'';if(c.trim())ms.push({role:'user',content:c})})
        document.querySelectorAll('[data-testid="ai-message"]').forEach(el=>{const c=el.textContent||'';if(c.trim())ms.push({role:'assistant',content:c})})
      }
      if (ms.length===0) {
        document.querySelectorAll('ms-chat-turn').forEach(t=>{
          const u=t.querySelector('[class*="user"],[class*="user-turn"]');if(u?.textContent?.trim())ms.push({role:'user',content:u.textContent})
          const a=t.querySelector('[data-test-id="model-response"]');if(a?.textContent?.trim())ms.push({role:'assistant',content:a.textContent})
        })
      }
      // 策略 4: DeepSeek — 多步回退
      if (ms.length===0) {
        const skip = 'input,textarea,[contenteditable="true"],button,nav,header,footer,aside,script,style,svg,iframe,noscript,code,pre'
        const chatSel = ['.ds-markdown','[class*="chat-content"]','[class*="chat-main"]','[class*="message-list"]','[class*="conversation"]','main[role="main"]'].find(s=>document.querySelector(s))
        const candidates: Element[] = []

        // 4a: 聊天容器内找所有消息
        if (chatSel) {
          const container = document.querySelector(chatSel)!
          container.querySelectorAll('div,section,article').forEach(el=>{
            if (el.closest(skip)) return
            const c=el.textContent||'';if(c.length>10&&c.trim()) candidates.push(el)
          })
        }
        
        // 4b: 已知的选择器
        document.querySelectorAll('.ds-assistant-message-main-content,[class*="assistant-message"],[class*="ai-message"],[class*="response"],[class*="user-message"],[class*="question"],[class*="sender"]').forEach(el=>{
          if (el.closest(skip)) return
          const c=el.textContent||'';if(c.length>5&&c.trim()) candidates.push(el)
        })

        // 分类：找类名中的 role 关键词
        for (const el of candidates) {
          const c = el.textContent||''; if (!c.trim()||c.length<5) continue
          if (ms.some(m=>m.content===c)) continue
          const cls = (el.className||'')+(el.getAttribute('class')||'')
          const isAI = /assistant|ai-message|model|bot|response|markdown/i.test(cls)
          const isUser = /user-message|question|sender/i.test(cls)
          if (isAI || isUser) ms.push({ role: isAI?'assistant':'user', content: c })
          else if (candidates.length <= 5) ms.push({ role: 'assistant', content: c })
        }
      }
      return {messages:ms}
    },
    injectText: (t:string) => { appendToInput(t) },
    sendMessage: () => { simulateSend() },
    onLog: (type,msg) => panel?.addLog(type,msg),
    onStatus: (text) => panel?.updateStatusBar(text),
  })
  agent.setDirectory(dirHandle)
  // 启动前跳过已有消息
  const existing = countCurrentAIMessages()
  agent.start(existing)
  // 调试：报告当前检测到的消息数
  setTimeout(() => {
    const ds = document.querySelectorAll('[data-message-author-role]').length
    const dsAssist = document.querySelectorAll('.ds-assistant-message-main-content, [class*="assistant-message"]').length
    panel?.addLog('info', `Msg detect: [author]=${ds}, ds-assist=${dsAssist}`)
  }, 2000)
}

// ============================================================
// Chrome Extension 消息处理器
// ============================================================

registerExtensionHandler({
  selectProject: async () => {
    const r = await selectProjectFolder()
    if (!r) return null
    dirHandle = r.handle
    projectName = r.name
    await saveHandle(r.handle)
    saveProjectName(r.name)
    const tree = await readDirectoryStructure(r.handle)
    afterProjectConnected()
    return { name: r.name, fileCount: countFiles(tree), tree }
  },

  getProjectInfo: async () => {
    if (!dirHandle) return { path: '', fileCount: 0 }
    const tree = await readDirectoryStructure(dirHandle)
    return { path: dirHandle.name, fileCount: countFiles(tree) }
  },

  executeCommand: async (cmd: string) => {
    if (!dirHandle) throw new Error('请先选择项目')
    if (!(await verifyPermission(dirHandle))) throw new Error('权限失效')

    const c = parseCmd(cmd)
    const log: Array<{ type: string; msg: string }> = []
    let tree: FileEntry[] | undefined

    switch (c.action) {
      case 'list':
        tree = await readDirectoryStructure(dirHandle)
        log.push({ type: 'success', msg: `已列出${countFiles(tree)}个文件` })
        break
      case 'read':
        if (!c.filePath) throw new Error('请指定路径')
        const ct = await readFile(dirHandle, c.filePath)
        writeToInput(ct)
        log.push({ type: 'info', msg: `读取${c.filePath}(${ct.length}字符)` })
        break
      case 'write':
        if (!c.filePath || c.content === undefined) throw new Error('请指定路径和内容')
        await writeFile(dirHandle, c.filePath, c.content)
        log.push({ type: 'success', msg: `已写入${c.filePath}` })
        break
      default:
        log.push({ type: 'warn', msg: '无法识别' })
    }

    return {
      log,
      tree,
      projectInfo: { name: dirHandle.name, fileCount: tree ? countFiles(tree) : 0 },
    }
  },
})

interface ParsedCmd {
  action: string
  filePath?: string
  content?: string
}

function parseCmd(input: string): ParsedCmd {
  const lower = input.toLowerCase().trim()
  if (lower === 'list' || lower === 'ls') return { action: 'list' }
  const rm = lower.match(/^(?:read|cat|查看|读取)\s+(\S.+)/)
  if (rm) return { action: 'read', filePath: rm[1].trim() }
  const wm = input.match(/^(?:write|写入|创建|修改)\s+(\S+)\s*[：:]\s*(.+)/s)
  if (wm) return { action: 'write', filePath: wm[1].trim(), content: wm[2].trim() }
  return { action: 'unknown' }
}

function writeToInput(text: string): void {
  const sels = [
    '#prompt-textarea',
    'div[contenteditable="true"]',
    'textarea#chat-input',
    '.chat-input-editor',
    'textarea',
  ]
  for (const sel of sels) {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) continue
    if (el.isContentEditable) {
      el.focus()
      document.execCommand('insertText', false, text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.value = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
  }
}

setTimeout(main,500)
