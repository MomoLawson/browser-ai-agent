---
name: security
description: Security audit and vulnerability check
---
# Security Audit

Perform a security audit of the specified code or project.

## Checklist

### Input Validation
- [ ] All user inputs are validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] HTML output is properly escaped (XSS prevention)
- [ ] File paths are validated (path traversal prevention)
- [ ] URLs are validated (SSRF prevention)

### Authentication & Authorization
- [ ] No hardcoded credentials or secrets
- [ ] Tokens have appropriate expiration
- [ ] Authorization checks before sensitive operations
- [ ] Rate limiting on auth endpoints
- [ ] Password requirements enforced

### Data Protection
- [ ] Sensitive data is encrypted at rest and in transit
- [ ] PII is not logged or exposed in errors
- [ ] API keys not in client-side code
- [ ] CORS configured correctly

### Dependencies
- [ ] No known vulnerable dependencies
- [ ] Dependencies pinned to specific versions
- [ ] No unused dependencies

### Error Handling
- [ ] Errors don't leak internal details
- [ ] Stack traces hidden in production
- [ ] Proper error codes (not generic 500)

## Output Format
For each finding:
```
[SEVERITY] CWE-XXX: Title
  Location: file:line
  Description: what's wrong
  Fix: how to fix it
```
