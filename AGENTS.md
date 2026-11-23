# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Surface Better Alternatives

I'm always open to ideas on better ways to do things. Please don't hesitate to suggest a better way, or one that has long lasting impact over a tactical change.

---

# Project Workflow Rules (Trade Journal V3)

1. **Prototypes Are the Authoritative Visual & UX Spec:**
   - Before building or modifying any screen, read the corresponding reference file in `prototypes/` (`prototypes/trade-detail/index.html`, `prototypes/review-coach-mockup/index.html`, `prototypes/replay/round-2.html`).
   - Match the prototype's warm paper/ink tokens (`#f7f3ea` ground, `#ffffff` cards, `#1c1b19` ink, `#55524b` muted, `#d9d3c5` hairline borders), pill controls, tabular numerals, and layout structure. Never modify prototypes to match the app.
2. **Browser-Critic Prototype Diff Gate:**
   - Every deliverable's independent browser critic must explicitly verify visual, layout, and token parity against the matching `prototypes/` screen on both desktop and mobile viewports, alongside live upgrade/migration and zero console/page errors.
3. **OCR Artifacts Inside Repo Only:**
   - Store all OpenCodeReview (`ocr`) background and JSON output files under `.ocr/<tag>/` (gitignored and excluded by `.agents/ocr-rule.json`). Never write OCR artifacts to `/tmp`.
4. **Scoped Playwright Locators:**
   - Mounted tabs stay in the DOM via `hidden` to preserve unsaved edits across tab switches. Scope Playwright assertions to visible regions, rails, or tables rather than unscoped `page.getByText(...)`.
