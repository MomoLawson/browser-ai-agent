---
name: refactor
description: Safe refactoring with behavior preservation
---
# Refactor

Refactor the specified code while preserving exact behavior.

## Process
1. **Read** the target file(s) first — never refactor blind
2. **Identify** the code smell (duplication, long function, deep nesting, etc.)
3. **Plan** the refactoring steps before editing
4. **Apply** changes incrementally using [edit] — one logical change per edit
5. **Verify** the result still makes sense

## Common Patterns
- **Extract function**: Pull repeated or self-contained logic into a named function
- **Early return**: Replace nested if/else with guard clauses
- **Destructure**: Simplify repeated property access
- **Constants**: Replace magic numbers/strings with named constants
- **Type narrowing**: Replace `any` with proper types
- **Reduce nesting**: Flatten deeply nested callbacks/conditionals

## Rules
- NEVER change behavior — refactoring means same input, same output
- NEVER rename public API surfaces without explicit request
- Prefer small, incremental edits over large rewrites
- If the refactoring would change behavior, STOP and report it
