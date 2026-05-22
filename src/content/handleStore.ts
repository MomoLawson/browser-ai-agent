/**
 * handleStore — 使用 IndexedDB 持久化 FileSystemDirectoryHandle
 *
 * FileSystemHandle 实现了 Serializable 接口，可以直接存入 IndexedDB。
 * 即使页面刷新或关闭后重新打开，也可以恢复 handle 并重新获取权限。
 */
const DB_NAME = 'bai-agent-fs'
const STORE_NAME = 'handles'
const KEY = 'project-dir'
const VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * 将 DirectoryHandle 存入 IndexedDB
 */
export async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/**
 * 从 IndexedDB 读取之前保存的 DirectoryHandle
 */
export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(KEY)
      req.onsuccess = () => { db.close(); resolve(req.result || null) }
      req.onerror = () => { db.close(); resolve(null) }
    })
  } catch {
    return null
  }
}

/**
 * 验证 handle 权限是否仍然有效，失效则尝试重新请求
 * 返回 true 表示权限可用
 */
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  try {
    // 先查询当前权限
    const queryOpts: FileSystemGetDirectoryOptions = { mode }
    let state = await handle.queryPermission(queryOpts)

    if (state === 'granted') return true

    // 权限已过期，尝试重新请求
    // Chrome 122+ 支持持久权限，用户只需确认一次
    state = await handle.requestPermission(queryOpts)
    return state === 'granted'
  } catch {
    return false
  }
}

/**
 * 从 IndexedDB 中删除保存的 handle
 */
export async function removeHandle(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
