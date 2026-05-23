/**
 * icons — Font Awesome 类名映射
 * 配合 @require font-awesome 6.7.2 JS 全量包使用。
 * CSP 绕过原理：@require 在安装时下载，运行时从本地加载。
 */
const MAP: Record<string, string> = {
  bot: 'fa-solid fa-robot',
  x: 'fa-solid fa-xmark',
  folderOpen: 'fa-solid fa-folder-open',
  messageSquare: 'fa-solid fa-message',
  clipboardPaste: 'fa-solid fa-paste',
  copy: 'fa-solid fa-copy',
  list: 'fa-solid fa-list',
  trash2: 'fa-solid fa-trash-can',
  settings: 'fa-solid fa-gear',
  sliders: 'fa-solid fa-sliders',
  check: 'fa-solid fa-check',
}

export function fa(name: string): string {
  return MAP[name] || ''
}

/** 在 Shadow DOM 中渲染 Font Awesome 图标（把 <i> → <svg>） */
export function renderFA(root: ShadowRoot): void {
  try {
    const FA = (window as any).FontAwesome
    if (FA?.dom?.i2svg) FA.dom.i2svg({ node: root })
  } catch {}
}
