/**
 * Built-in Skills — 随项目一起加载的核心技能
 */
import type { Skill } from './skills'

function s(name: string, description: string, body: string): Skill {
  return { name, description, content: `---\nname: ${name}\ndescription: ${description}\n---\n${body}`, body }
}

export const BUILTIN_SKILLS: Skill[] = [
  s('code-review', 'Comprehensive code review for bugs, security, and quality', `# Code Review

Perform a thorough code review. Check for:

## Correctness
- Off-by-one errors, null/undefined access, race conditions
- Missing error handling, unreachable code, logic errors

## Security
- Input validation (XSS, injection), hardcoded secrets
- Insecure defaults, path traversal

## Performance
- Unnecessary re-renders, expensive loops, memory leaks
- N+1 queries, missing memoization

## Maintainability
- Functions > 50 lines, deep nesting, magic numbers
- Missing types, dead code, duplicated logic

## Output
For each issue: \`L{line} [{severity}] {category}: {description}\``),

  s('refactor', 'Safe refactoring with behavior preservation', `# Refactor

Refactor the target code while preserving exact behavior.

## Process
1. Read the target file(s) first
2. Identify the code smell
3. Apply one logical change per edit

## Patterns
- Extract function, early return, destructure
- Named constants, type narrowing, reduce nesting

## Rules
- NEVER change behavior — same input, same output
- NEVER rename public APIs without explicit request
- Prefer small incremental edits over large rewrites`),

  s('test', 'Write or improve tests', `# Test

Write or improve tests for the target code.

## Process
1. Read the target code and existing tests
2. Identify the testing framework in use
3. Write tests: happy path, edge cases, errors

## Naming
\`\`\`
describe('functionName', () => {
  it('should handle normal case', ...)
  it('should handle edge case', ...)
  it('should throw on invalid input', ...)
})
\`\`\`

## Rules
- Follow the project's testing patterns
- Mock external dependencies, not internal logic
- Use descriptive test names`),

  s('security', 'Security audit and vulnerability check', `# Security Audit

Check the target code for vulnerabilities:

## Checklist
- Input validation and sanitization
- SQL/XSS/command injection prevention
- Hardcoded secrets or credentials
- CORS and CSP configuration
- Rate limiting and auth checks
- Error messages leaking internal details

## Output
\`[SEVERITY] CWE-XXX: Title | file:line | fix\``),

  s('debug', 'Systematic debugging methodology', `# Debug

Debug the reported issue systematically.

## Process
1. Reproduce → Isolate → Diagnose → Fix → Verify

## Techniques
- Read error messages carefully
- Check recent changes (\`git log\`, \`git diff\`)
- Binary search: comment out half the code
- Simplify: create minimal reproduction

## Rules
- Always read the error message before guessing
- Don't fix symptoms — find root cause
- One fix at a time`),

  s('commit', 'Write clear, conventional commit messages', `# Commit

Analyze current changes and write a commit message.

## Format
\`<type>(<scope>): <subject>\`

## Types
feat, fix, refactor, docs, test, chore, perf, style

## Rules
- Subject: imperative mood, max 72 chars, no period
- Body: explain WHAT and WHY, not HOW
- One logical change per commit`),

  s('docs', 'Generate or improve documentation', `# Documentation

Generate or improve docs for the target code.

## Rules
- Document WHY, not WHAT
- Include usage examples for public APIs
- Keep docs up to date with code changes
- Use the project's existing doc style`),

  s('explain', 'Explain how code works', `# Explain

Explain how the target code works in plain language.

## Approach
1. Read the code and its dependencies
2. Identify the high-level purpose
3. Break down the key logic steps
4. Note any non-obvious decisions or patterns

## Output
- Start with a one-sentence summary
- Walk through the flow step by step
- Highlight anything surprising or clever
- Mention edge cases handled`),
]
