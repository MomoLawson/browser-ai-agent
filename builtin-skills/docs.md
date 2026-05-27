---
name: docs
description: Generate or improve documentation
---
# Documentation

Generate or improve documentation for the specified code.

## Types
- **README**: Project overview, setup, usage, architecture
- **API docs**: Function signatures, parameters, return types, examples
- **Inline comments**: Explain WHY, not WHAT (the code shows what)
- **JSDoc/TSDoc**: Structured function documentation

## Process
1. Read the target code thoroughly
2. Identify what needs documentation
3. Write clear, concise docs

## Rules
- Never document the obvious — `const name = '...'` doesn't need a comment
- Document WHY decisions were made, not what the code does
- Include usage examples for public APIs
- Keep docs up to date with code changes
- Use the project's existing documentation style

## README Template
```markdown
# Project Name
One-line description.

## Setup
npm install && npm run dev

## Usage
Brief usage example.

## Architecture
Key files and their roles.
```
