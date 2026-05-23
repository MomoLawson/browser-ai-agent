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
import { createAgentStyles } from './ui/styles'
import { TriggerButton } from './ui/TriggerButton'
import { AgentPanel } from './ui/AgentPanel'
import { AgentLoop } from './agentLoop'
import { selectProjectFolder, readDirectoryStructure } from './fileSystem'
import { saveProjectName } from './promptInjector'
import { saveHandle } from './handleStore'
import { fillInput, appendToInput, simulateSend } from './injectUtils'
import { loadSettings, resolveLang, buildSystemPrompt, t, type Lang } from './settings'

let dirHandle: FileSystemDirectoryHandle | null = null
let trigger: TriggerButton | null = null
let panel: AgentPanel | null = null
let agent: AgentLoop | null = null
let projectName = ''

let _lucideLoaded = false

function loadLucide(): void {
  if (_lucideLoaded) return
  try {
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/lucide@0.487.0/dist/umd/lucide.min.js'
    s.onload = () => { _lucideLoaded = true; console.log('[BAI] Lucide loaded') }
    s.onerror = () => console.log('[BAI] Lucide load failed, fallback to text')
    document.head.appendChild(s)
  } catch {}
}

function main(): void {
  loadLucide()
  const platform = detectPlatform()
  if (!platform) { console.log('[BAI] 不支持'); return }
  console.log(`[BAI] 检测到 ${getPlatformDisplayName(platform)}`)
  createAgentStyles()
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
    panel!.setStatus('listening', 'listening')
    panel!.addLog('info', `Project: ${projectName}`)
  }

  // 提示词复制到输入框
  panel!.onCopyToInput = (text: string) => {
    fillInput(text)
    panel!.addLog('success', 'Prompt filled into input')
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
  panel.setStatus('listening', 'Prompt ready - copy and send')

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
// Chrome Extension
// ============================================================
import { readFile, writeFile, verifyPermission } from './fileSystem'
if (typeof chrome!=='undefined'&&chrome.runtime?.id) {
  chrome.runtime.onMessage.addListener((msg:any,_,res)=>{
    const r=(ok:boolean,d?:any,e?:string)=>res({id:msg.id,success:ok,data:d,error:e})
    switch(msg.type){
      case'SELECT_PROJECT':{;(async()=>{try{const f=await selectProjectFolder();if(!f){r(true,null);return}dirHandle=f.handle;projectName=f.name;await saveHandle(f.handle);saveProjectName(f.name);const t=await readDirectoryStructure(f.handle);r(true,{name:f.name,fileCount:countFiles(t),tree:t})}catch(e){r(false,null,(e as Error).message)}})();return true}
      case'GET_PROJECT_INFO':{if(!dirHandle){r(true,{path:'',fileCount:0});return};(async()=>{try{const t=await readDirectoryStructure(dirHandle!);r(true,{path:dirHandle!.name,fileCount:countFiles(t)})}catch{r(true,{path:dirHandle!.name,fileCount:0})}})();return true}
      case'EXECUTE_COMMAND':{;(async()=>{try{if(!dirHandle){r(false,null,'请先选择项目');return}if(!await verifyPermission(dirHandle)){r(false,null,'权限失效');return}const c=parseCmd(msg.payload?.cmd||'');const l:Array<{type:string;msg:string}>=[];let t=null,pi=null;switch(c.action){case'list':t=await readDirectoryStructure(dirHandle!);l.push({type:'success',msg:`已列出${countFiles(t)}个文件`});break;case'read':if(!c.filePath){r(false,null,'请指定路径');return}const ct=await readFile(dirHandle!,c.filePath);ci(ct);l.push({type:'info',msg:`读取${c.filePath}(${ct.length}字符)`});break;case'write':if(!c.filePath||c.content===undefined){r(false,null,'请指定路径和内容');return}await writeFile(dirHandle!,c.filePath,c.content);l.push({type:'success',msg:`已写入${c.filePath}`});break;default:l.push({type:'warn',msg:'无法识别'})}pi={name:dirHandle!.name,fileCount:t?countFiles(t):0};r(true,{log:l,tree:t,projectInfo:pi})}catch(e){r(false,null,(e as Error).message)}})();return true}
    }
  })
}
interface ParsedCmd{action:string;filePath?:string;content?:string}
function parseCmd(i:string):ParsedCmd{const l=i.toLowerCase().trim();if(l==='list'||l==='ls')return{action:'list'};const rm=l.match(/^(?:read|cat|查看|读取)\s+(\S.+)/);if(rm)return{action:'read',filePath:rm[1].trim()};const wm=i.match(/^(?:write|写入|创建|修改)\s+(\S+)\s*[：:]\s*(.+)/s);if(wm)return{action:'write',filePath:wm[1].trim(),content:wm[2].trim()};return{action:'unknown'}}
function ci(t:string):void{const s=['#prompt-textarea','div[contenteditable="true"]','textarea#chat-input','.chat-input-editor','textarea'];for(const x of s){const el=document.querySelector<HTMLElement>(x);if(!el)continue;if(el.isContentEditable){el.focus();document.execCommand('insertText',false,t);el.dispatchEvent(new Event('input',{bubbles:true}));return}if(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement){el.value=t;el.dispatchEvent(new Event('input',{bubbles:true}));return}}}

function countFiles(entries: import('../shared/types').FileEntry[]): number {
  let c=0;for(const e of entries){if(e.kind==='file')c++;if(e.children)c+=countFiles(e.children)}return c
}

setTimeout(main,500)
