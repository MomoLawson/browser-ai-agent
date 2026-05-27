/**
 * Skills — 内置技能 + 项目 .bai/skills/ 用户技能
 *
 * 技能文件格式（Markdown + YAML frontmatter）：
 * ---
 * name: code-review
 * description: Review code for best practices
 * ---
 * # Code Review Skill
 * 详细内容...
 */

import { BUILTIN_SKILLS } from './builtin-skills'

export interface Skill {
  name: string
  description: string
  content: string   // 完整内容（含 frontmatter）
  body: string      // 去掉 frontmatter 后的正文
}

// 缓存当前项目的技能（内置 + 用户）
let _skills: Skill[] = [...BUILTIN_SKILLS]

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+)\s*:\s*(.+)/)
    if (m) meta[m[1].trim()] = m[2].trim()
  }
  return { meta, body: match[2] }
}

/**
 * 扫描 .bai/skills/ 目录，加载所有技能
 */
export async function loadSkills(dirHandle: FileSystemDirectoryHandle): Promise<Skill[]> {
  const userSkills: Skill[] = []
  try {
    const baiDir = await dirHandle.getDirectoryHandle('.bai').catch(() => null)
    if (baiDir) {
      const skillsDir = await baiDir.getDirectoryHandle('skills').catch(() => null)
      if (skillsDir) {
        for await (const [name, handle] of skillsDir as any) {
          if (handle.kind !== 'file' || !name.endsWith('.md')) continue
          try {
            const file = await handle.getFile()
            const raw = await file.text()
            const { meta, body } = parseFrontmatter(raw)
            userSkills.push({
              name: meta.name || name.replace(/\.md$/, ''),
              description: meta.description || '',
              content: raw,
              body,
            })
          } catch { /* skip */ }
        }
      }
    }
  } catch { /* .bai 不存在 */ }

  // 用户技能覆盖同名内置技能
  const merged = new Map<string, Skill>()
  for (const s of BUILTIN_SKILLS) merged.set(s.name.toLowerCase(), s)
  for (const s of userSkills) merged.set(s.name.toLowerCase(), s)
  _skills = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
  return _skills
}

/**
 * 获取已加载的技能列表
 */
export function getSkills(): Skill[] {
  return _skills
}

/**
 * 按名称查找技能
 */
export function findSkill(name: string): Skill | undefined {
  const lower = name.toLowerCase()
  return _skills.find(s => s.name.toLowerCase() === lower)
    || _skills.find(s => s.name.toLowerCase().includes(lower))
}

/**
 * 生成技能摘要（写入系统提示词）
 */
export function formatSkillList(skills: Skill[]): string {
  if (skills.length === 0) return ''
  const lines = skills.map(s => `  - ${s.name}${s.description ? ': ' + s.description : ''}`)
  return [
    '',
    'Installed Skills (in .bai/skills/):',
    ...lines,
    'Use [skill: name] to view a skill\'s full content before following its instructions.',
  ].join('\n')
}
