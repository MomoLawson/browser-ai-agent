/**
 * Chrome Extension 弹窗
 *
 * 与当前标签页的 content script 通信，执行文件操作。
 * popup 不能直接调用 showDirectoryPicker()，需要 content script 代理。
 */
import type { FileEntry } from '../shared/types'

// ============================================================
// 消息通信
// ============================================================

let tabId: number | null = null

function sendMessage(type: string, payload?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!tabId) { reject(new Error('No active tab')); return }
    chrome.tabs.sendMessage(tabId, { type, payload, id: Date.now().toString() }, (resp) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else if (!resp) reject(new Error('No response from content script'))
      else resolve(resp.data)
    })
  })
}

// ============================================================
// DOM 引用
// ============================================================

const $ = (id: string) => document.getElementById(id)!
const elStatus = $('statusDot')
const elProject = $('projectInfo')
const elSelectBtn = $('selectBtn') as HTMLButtonElement
const elExecBtn = $('execBtn') as HTMLButtonElement
const elInput = $('inputField') as HTMLTextAreaElement
const elLogBox = $('logBox')
const elFileTree = $('fileTree')
const elTreeToggle = $('treeToggle')

function addLog(type: string, msg: string): void {
  const empty = elLogBox.querySelector('.log-empty')
  if (empty) empty.remove()
  const e = document.createElement('div')
  e.className = 'log-entry'
  e.innerHTML = `<span class="log-time">${new Date().toLocaleTimeString()}</span><span class="log-msg ${type}">${esc(msg)}</span>`
  elLogBox.appendChild(e)
  elLogBox.scrollTop = elLogBox.scrollHeight
}

function setProjectInfo(name: string, count: number): void {
  elProject.innerHTML = `<span class="lbl">项目:</span> ${esc(name)} <span style="margin-left:8px;color:#94a3b8">|</span> <span class="lbl">文件:</span> ${count} 个`
  elProject.classList.add('active')
}

function setFileTree(entries: FileEntry[]): void {
  elFileTree.innerHTML = renderTree(entries)
  elFileTree.classList.add('show')
  elTreeToggle.textContent = '📂 收起文件树'
}

function setStatus(s: string): void { elStatus.className = `dot ${s}` }

function esc(t: string): string {
  const d = document.createElement('div')
  d.textContent = t; return d.innerHTML
}

function renderTree(entries: FileEntry[], depth = 0): string {
  let h = ''
  for (const e of entries) {
    const indent = '<span class="in"></span>'.repeat(depth)
    if (e.kind === 'directory') {
      h += `<div class="fitem dir">${indent}📁${esc(e.name)}/</div>`
      if (e.children) h += renderTree(e.children, depth + 1)
    } else {
      h += `<div class="fitem">${indent}📄${esc(e.name)}</div>`
    }
  }
  return h
}

// ============================================================
// 初始化
// ============================================================

async function init(): Promise<void> {
  // 获取当前标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) { addLog('error', '无活动标签页'); return }
  tabId = tab.id

  // 尝试获取当前项目状态
  try {
    const info = await sendMessage('GET_PROJECT_INFO')
    if (info?.path) {
      setProjectInfo(info.path, info.fileCount || 0)
    }
  } catch {
    addLog('info', '当前页面未加载 Agent，请刷新后重试')
  }

  // 选择项目
  elSelectBtn.addEventListener('click', async () => {
    elSelectBtn.disabled = true
    elSelectBtn.textContent = '⏳...'
    try {
      const result = await sendMessage('SELECT_PROJECT')
      if (result) {
        setProjectInfo(result.name, result.fileCount)
        if (result.tree) setFileTree(result.tree)
        addLog('success', `已选择项目: ${result.name}`)
      }
    } catch (err) {
      addLog('error', `选择失败: ${(err as Error).message}`)
    } finally {
      elSelectBtn.disabled = false
      elSelectBtn.textContent = '📁 选择项目'
    }
  })

  // 执行指令
  elExecBtn.addEventListener('click', async () => {
    const cmd = elInput.value.trim()
    if (!cmd) return
    elExecBtn.disabled = true
    elExecBtn.textContent = '⏳...'
    setStatus('running')
    addLog('info', `开始执行: ${cmd}`)
    try {
      const result = await sendMessage('EXECUTE_COMMAND', { cmd })
      if (result?.log) result.log.forEach((l: any) => addLog(l.type, l.msg))
      if (result?.tree) setFileTree(result.tree)
      if (result?.projectInfo) setProjectInfo(result.projectInfo.name, result.projectInfo.fileCount)
      setStatus('completed')
      elInput.value = ''
    } catch (err) {
      addLog('error', `执行失败: ${(err as Error).message}`)
      setStatus('error')
    } finally {
      elExecBtn.disabled = false
      elExecBtn.textContent = '▶ 执行'
    }
  })

  // 文件树折叠
  elTreeToggle.addEventListener('click', () => {
    elFileTree.classList.toggle('show')
    elTreeToggle.textContent = elFileTree.classList.contains('show') ? '📂 收起文件树' : '📂 查看项目文件'
  })

  // 输入框自适应高度
  elInput.addEventListener('input', () => {
    elInput.style.height = 'auto'
    elInput.style.height = Math.min(elInput.scrollHeight, 64) + 'px'
  })
}

document.addEventListener('DOMContentLoaded', init)
