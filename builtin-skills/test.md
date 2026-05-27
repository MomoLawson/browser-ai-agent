---
name: test
description: Write or improve tests for the codebase
---
# Test

Write or improve tests for the specified code.

## Approach
1. **Read** the target code to understand its behavior
2. **Identify** the testing framework used in the project (check package.json)
3. **Plan** test cases covering happy path, edge cases, and error cases
4. **Write** tests following the project's existing patterns

## Test Case Priorities
1. **Happy path**: Normal inputs, expected outputs
2. **Edge cases**: Empty input, null/undefined, boundary values, max/min
3. **Error cases**: Invalid input, network failures, permission denied
4. **Integration**: How the code interacts with its dependencies

## Naming Convention
```
describe('functionName', () => {
  it('should handle normal case', () => { ... })
  it('should handle empty input', () => { ... })
  it('should throw on invalid input', () => { ... })
})
```

## Rules
- Read existing tests before writing new ones (avoid duplicates)
- Follow the project's testing patterns and utilities
- Use descriptive test names that explain the expected behavior
- Mock external dependencies, not internal logic
- Prefer integration tests over unit tests for critical paths
