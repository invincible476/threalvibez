---
description: Automated log diagnosis and source code fixing workflow for application errors and stack traces
---

# 🛠️ Log Diagnosis and Automated Error Fix Workflow

This workflow automates the process of monitoring application logs, identifying stack traces or unhandled exceptions in `./logs/app.log`, diagnosing the root cause, and applying source code fixes.

---

## 📋 Steps to Execute

### Step 1: Read and Parse `./logs/app.log`
1. Check for the existence of `./logs/app.log` (and `./logs/error.log` if available).
2. Scan the last 500 lines for error keywords: `Error:`, `TypeError:`, `ReferenceError:`, `UnhandledPromiseRejection:`, `SyntaxError:`, `FATAL`, or HTTP 500 status codes.
3. Extract complete stack traces, including error messages, file paths, line numbers, and call stacks.

```bash
node scripts/log-cli.js tail --file=app --level=error --lines=100
```

### Step 2: Extract Source File Locations & Context
1. Identify all project files referenced in the stack trace (focusing on `src/...` or relative workspace paths).
2. Use `view_file` to view the exact code lines around the stack trace location (e.g., ±20 lines around the reported line number).
3. Do NOT guess schemas or types; inspect imported modules and parent functions if needed.

### Step 3: Perform Root Cause Analysis
1. Analyze why the error occurred:
   - Null or undefined property access?
   - Unhandled async rejection or missing error response check?
   - Invalid prop types or broken imports?
   - Database / Firebase permissions or uninitialized connection?
2. Ensure fixes address the root cause rather than patching symptoms (never wrap in silent `try/catch` or return dummy fallbacks).

### Step 4: Apply Code Fixes
1. Edit the target source files using `replace_file_content` or `multi_replace_file_content`.
2. Preserve existing docstrings, comments, and unrelated functionality.

### Step 5: Verification & Log Re-check
1. Run TypeScript typecheck to ensure compile-time safety:
   ```bash
   npm run typecheck
   ```
2. Verify system health using:
   ```bash
   npm run launch:check-env
   ```
3. Confirm clean resolution and report findings, root cause, and applied code changes.
