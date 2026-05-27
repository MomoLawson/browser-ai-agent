---
name: code-review
description: Comprehensive code review for bugs, security, and quality
---
# Code Review

Perform a thorough code review of the specified file(s). Check for:

## Correctness
- Off-by-one errors, null/undefined access, race conditions
- Missing error handling, unreachable code, logic errors
- Type mismatches, incorrect assumptions about data shape

## Security
- Input validation and sanitization (XSS, SQL injection, command injection)
- Hardcoded secrets, tokens, or credentials
- Insecure defaults (CORS, CSP, cookie flags)
- Prototype pollution, ReDoS, path traversal

## Performance
- Unnecessary re-renders, expensive operations in loops
- Missing memoization, redundant computations
- Memory leaks (event listeners, closures, timers)
- N+1 queries, missing indexes

## Maintainability
- Functions > 50 lines, deeply nested logic, magic numbers
- Missing types, any abuse, inconsistent naming
- Dead code, duplicated logic, overly clever solutions

## Output Format
For each issue found:
```
L{line} [{severity}] {category}: {description}
  Fix: {suggested fix}
```
