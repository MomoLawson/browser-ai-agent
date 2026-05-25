/**
 * todo — 简易 Todo 工具（localStorage 存储）
 */

const STORAGE_PREFIX = 'bai_todo_'

export interface TodoItem {
  id: number
  text: string
  done: boolean
  createdAt: number
}

export function loadTodos(project: string): TodoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + project)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveTodos(project: string, todos: TodoItem[]): void {
  try { localStorage.setItem(STORAGE_PREFIX + project, JSON.stringify(todos)) } catch {}
}

let _nextId = 1

export function addTodo(project: string, text: string): TodoItem[] {
  const todos = loadTodos(project)
  const maxId = todos.reduce((m, t) => Math.max(m, t.id), 0)
  _nextId = maxId + 1
  todos.push({ id: _nextId, text, done: false, createdAt: Date.now() })
  _nextId++
  saveTodos(project, todos)
  return todos
}

export function toggleTodo(project: string, id: number): TodoItem[] {
  const todos = loadTodos(project)
  const t = todos.find(t => t.id === id)
  if (t) t.done = !t.done
  saveTodos(project, todos)
  return todos
}

export function removeTodo(project: string, id: number): TodoItem[] {
  const todos = loadTodos(project).filter(t => t.id !== id)
  saveTodos(project, todos)
  return todos
}

export function clearTodos(project: string): TodoItem[] {
  saveTodos(project, [])
  return []
}

/** 格式化为纯文本（注入给 AI 看） */
export function formatTodoText(todos: TodoItem[]): string {
  if (todos.length === 0) return '(no todos)'
  return todos.map(t => `${t.done ? '[x]' : '[ ]'} ${t.id}. ${t.text}`).join('\n')
}
