---
name: debug
description: Systematic debugging methodology
---
# Debug

Help debug the reported issue systematically.

## Process
1. **Reproduce**: Understand the exact steps to trigger the bug
2. **Isolate**: Narrow down where the bug occurs
3. **Diagnose**: Identify the root cause
4. **Fix**: Apply the minimal fix
5. **Verify**: Confirm the fix works and doesn't break anything else

## Techniques
- **Read error messages carefully** — they usually tell you exactly what's wrong
- **Add logging** — instrument the code to see what's happening
- **Binary search** — comment out half the code to find which half has the bug
- **Check recent changes** — `git log` and `git diff` to see what changed
- **Read the docs** — check if you're using the API correctly
- **Simplify** — create a minimal reproduction of the issue

## Common Bug Categories
- **Null/undefined**: Missing null checks, optional chaining needed
- **Async issues**: Missing await, race conditions, unhandled promises
- **Type errors**: Wrong type passed, missing property, wrong format
- **State bugs**: Stale closures, missing re-renders, incorrect updates
- **Boundary conditions**: Off-by-one, empty arrays, edge case inputs

## Rules
- Always read the error message before guessing
- Don't fix symptoms — find the root cause
- Prefer reading code over adding console.log
- One fix at a time — don't refactor while debugging
