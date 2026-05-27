---
name: commit
description: Write clear, conventional commit messages
---
# Commit

Help write a clear commit message for the current changes.

## Process
1. Run `git diff` to see what changed
2. Run `git status` to see staged and unstaged files
3. Analyze the changes and write the message

## Conventional Commits Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only
- `test`: Adding or updating tests
- `chore`: Build, tooling, dependencies
- `perf`: Performance improvement
- `style`: Formatting, whitespace (no logic change)

## Rules
- Subject line: imperative mood, max 72 chars, no period
- Body: explain WHAT changed and WHY, not HOW (the diff shows how)
- Reference issues in footer: `Fixes #123`
- One logical change per commit
- Don't commit generated files, secrets, or IDE config
