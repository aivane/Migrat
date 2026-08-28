---
name: evidence-first-planning
description: Use when starting a new task, feature, or bug fix, or about to write a plan or hypothesis based on memory/assumption instead of checking the real system — including when picking up prior work, when unsure how an API/data/behavior actually works, or when a bug's cause "seems obvious" but hasn't been confirmed against real logs, data, or output.
---

# Evidence-First Planning

## Overview

Never plan or code from a guess when the real answer is one check away. Look at the actual system first — real code, real data, real output, real error — then plan, then act. A guess "confirmed" by success is not confirmation; it's luck.

**Violating the letter of this rule (checking `git log` but never opening the actual failing response) is violating the spirit of it.**

## When to Use

- Starting any feature, refactor, or bug fix — before writing a plan
- About to say "it's probably X" / "usually the API returns Y" without checking
- Resuming work from a summary, memory, or a previous session — the world may have moved since
- A bug's root cause "seems obvious" but hasn't been reproduced or confirmed with real data
- Choosing between two approaches without knowing which one the actual codebase/data supports

## Core Pattern

```
INVESTIGATE → PLAN → ACT
(real evidence)   (grounded)   (small, re-verified steps)
```

| Phase | Do | Skipped = red flag |
|---|---|---|
| **Investigate** | Read the real code, run the real command, call the real API, check the real log/error/response — not memory of "how this usually works" | "I'm pretty sure it's..." with no citation (file:line, log line, response body) |
| **Plan** | Write a short plan citing what you found. **REQUIRED SUB-SKILL:** superpowers:writing-plans for multi-step work; superpowers:brainstorming first if intent/scope is unclear. For ambiguous scope, gsd-core's discuss-phase style of evidence-cited assumptions (state the assumption, cite the file/data that supports it) works well here too | Jumping to code with no plan for anything beyond a one-line fix |
| **Act** | Execute in small steps, re-verify against real output after each one | Marking done because the change "looks right," not because you ran it |

## Bug Fixing Specifically

**REQUIRED SUB-SKILL:** superpowers:systematic-debugging — use its reproduce → root-cause → minimal-fix cycle. This skill only adds the evidence gate in front of it:

1. **Reproduce first.** No fix without seeing the actual failure yourself (output, stack trace, wrong value) — not a description of it.
2. **Gather evidence before hypothesizing.** Read the actual data flowing through (API response, DB row, prop value) at the point closest to the symptom.
3. **State the hypothesis and the evidence for it, explicitly.** "Probably a null field" is not a hypothesis until you've checked that the field is actually null.
4. **Verify the fix against real data**, not "the code compiles" or "it looks right now."

## This Project

This repo has no test suite or lint script (see [CLAUDE.md](../../../CLAUDE.md)) — "real data" here specifically means:

- The actual response shape from the live API (`VITE_FUNDINFO_API_MODE=direct`), not what a field is assumed to contain — check `context.md` §3 for confirmed field gaps first, then verify live if still unsure.
- Running `npm run dev` and exercising the affected page/flow in a browser, not just reading the diff.
- For `fundinfoApi.js`/`useFundinfo*.js` changes, confirm against a real network response (browser devtools / `read_network_requests`) before claiming a bug is fixed — mock mode (`VITE_FUNDINFO_API_MODE=mock`) uses fabricated data and will not surface real-API bugs.

## Rationalizations to Reject

| Excuse | Reality |
|---|---|
| "I already know how this API/library works" | APIs and data drift. One check costs seconds; a wrong fix costs a debugging session. |
| "The previous summary/session already confirmed this" | Summaries decay. Re-verify anything you're about to act on, not just recall it. |
| "The fix is obvious, no need to reproduce" | Obvious fixes for unreproduced bugs are the most common source of silent no-op patches. |
| "No time to check, just ship it" | Shipping a guess is slower than checking — it comes back as a bug report. |

## Red Flags — Stop and Check

- About to write a plan with no file/log/output cited as evidence
- About to fix a bug you haven't personally reproduced
- Trusting "usually X" over one real lookup
- Treating "compiles" or "looks right" as verification

**All of these mean: stop, go check the real thing, then continue.**
