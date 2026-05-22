/**
 * 文件系统操作封装
 *
 * 使用 File System Access API (showDirectoryPicker) 读写本地文件。
 * Userscript 模式下直接在页面上下文运行；
 * Chrome Extension 模式下通过 Service Worker 代理。
 */
import type { FileEntry } from '../shared/types'

/**
 * 选择项目文件夹
 */
export async function selectProjectFolder(): Promise<{
  handle: FileSystemDirectoryHandle
  name: string
} | null> {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    return { handle, name: handle.name }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      // 用户取消了选择
      return null
    }
    console.error('[BAI] 选择文件夹失败:', err)
    throw err
  }
}

/**
 * 验证目录句柄权限是否仍然有效
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  const options: FileSystemGetDirectoryOptions = {}
  const permission = await handle.queryPermission(options)
  if (permission === 'granted') return true

  const result = await handle.requestPermission(options)
  return result === 'granted'
}

/**
 * 递归读取目录结构
 */
export async function readDirectoryStructure(
  dirHandle: FileSystemDirectoryHandle,
  path = '',
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []

  for await (const entry of dirHandle.values()) {
    const fullPath = path ? `${path}/${entry.name}` : entry.name

    if (entry.kind === 'file') {
      entries.push({ name: entry.name, path: fullPath, kind: 'file' })
    } else if (entry.kind === 'directory') {
      entries.push({
        name: entry.name,
        path: fullPath,
        kind: 'directory',
        children: await readDirectoryStructure(entry as FileSystemDirectoryHandle, fullPath),
      })
    }
  }

  // 按 目录 > 文件 排序，各自按名称排序
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return entries
}

/**
 * 读取文件内容
 */
export async function readFile(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
): Promise<string> {
  const file = await getFileFromHandle(dirHandle, filePath)
  return await file.text()
}

/**
 * 写入文件内容（创建或覆盖）
 */
export async function writeFile(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
  content: string,
): Promise<void> {
  const parts = filePath.split('/')
  const fileName = parts.pop()!
  let currentHandle: FileSystemDirectoryHandle = dirHandle

  // 逐层确保目录存在
  for (const dirName of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true })
  }

  const fileHandle = await currentHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

/**
 * 删除文件或目录
 */
export async function deleteEntry(
  dirHandle: FileSystemDirectoryHandle,
  entryPath: string,
  kind: 'file' | 'directory',
): Promise<void> {
  const parts = entryPath.split('/')
  const name = parts.pop()!
  let currentHandle: FileSystemDirectoryHandle = dirHandle

  for (const dirName of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(dirName)
  }

  if (kind === 'file') {
    await currentHandle.removeEntry(name)
  } else {
    await currentHandle.removeEntry(name, { recursive: true })
  }
}

/**
 * 创建目录
 */
export async function createDirectory(
  dirHandle: FileSystemDirectoryHandle,
  dirPath: string,
): Promise<void> {
  const parts = dirPath.split('/')
  let currentHandle: FileSystemDirectoryHandle = dirHandle

  for (const dirName of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(dirName, { create: true })
  }
}

/**
 * 编辑文件 — 安全替换（必须提供完全匹配的原始内容）
 * 类似 claude code 的 edit 模式：old_str → new_str
 */
export async function editFile(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
  oldText: string,
  newText: string,
): Promise<boolean> {
  const content = await readFile(dirHandle, filePath)
  if (!content.includes(oldText)) {
    throw new Error(
      `✗ 文件中未找到匹配内容。文件当前内容:\n\`\`\`${content}\`\`\`\n` +
      `请检查后重新 [edit: ${filePath}]`
    )
  }
  const updated = content.replace(oldText, newText)
  await writeFile(dirHandle, filePath, updated)
  return true
}

/**
 * 检查文件是否已存在
 */
export async function fileExists(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
): Promise<boolean> {
  try {
    await getFileFromHandle(dirHandle, filePath)
    return true
  } catch {
    return false
  }
}

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 根据路径从 DirectoryHandle 中获取文件
 */
async function getFileFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  filePath: string,
): Promise<File> {
  const parts = filePath.split('/')
  const fileName = parts.pop()!
  let currentHandle: FileSystemDirectoryHandle = dirHandle

  for (const dirName of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(dirName)
  }

  const fileHandle = await currentHandle.getFileHandle(fileName)
  return await fileHandle.getFile()
}
