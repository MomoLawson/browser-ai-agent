/**
 * GM (Greasemonkey) API 类型声明
 *
 * vite-plugin-monkey 在构建时会自动处理 GM 函数的注入，
 * 但 TypeScript 需要这些类型声明才能通过编译。
 */

declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T
declare function GM_setValue<T = unknown>(key: string, value: T): void
declare function GM_deleteValue(key: string): void
declare function GM_listValues(): string[]
declare function GM_addStyle(css: string): HTMLStyleElement
declare function GM_addElement(tag: string, attributes: Record<string, string>): HTMLElement
declare function GM_xmlhttpRequest(details: {
  method: string
  url: string
  headers?: Record<string, string>
  data?: string
  onload?: (response: { status: number; responseText: string }) => void
  onerror?: (error: Error) => void
}): void

// File System Access API 类型补充
interface FileSystemDirectoryHandle {
  name: string
  kind: 'directory'
  values(): AsyncIterableIterator<FileSystemHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  queryPermission(descriptor?: FileSystemGetDirectoryOptions): Promise<FileSystemPermissionStatus>
  requestPermission(descriptor?: FileSystemGetDirectoryOptions): Promise<FileSystemPermissionStatus>
}

interface FileSystemFileHandle {
  name: string
  kind: 'file'
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | Blob | ArrayBuffer): Promise<void>
  seek(position: number): Promise<void>
  truncate(size: number): Promise<void>
  close(): Promise<void>
}

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle
type FileSystemPermissionMode = 'read' | 'readwrite'
type FileSystemPermissionStatus = 'granted' | 'denied' | 'prompt'

interface FileSystemGetDirectoryOptions {
  mode?: FileSystemPermissionMode
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: FileSystemPermissionMode
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
  }): Promise<FileSystemDirectoryHandle>
}
