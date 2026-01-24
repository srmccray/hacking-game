# Quick Sketch: Menu Text Overflow Fixes

**Created:** 2026-01-23
**Tier:** SMALL
**Triage Scores:** Complexity 3/10, Risk 2/10

## What

Audit and fix text overflow issues across all game menus where text can exceed container bounds and render outside visible areas or overlap other UI elements.

## Why

Text overflow creates a poor user experience, making the game appear unpolished. Long player names, minigame descriptions, and upgrade labels can clip or overlap, reducing readability and usability.

## Key Findings by File

### 1. `src/ui/InGameMenu.ts`
**Status:** Low risk - minimal overflow potential

- **Menu items** (lines 426-430): Center-anchored, static labels like "Resume", "Save Game", "Settings", "Exit to Main Menu"
- **Confirm dialog** (lines 498-562): Fixed text "EXIT TO MAIN MENU?", "Your game will be saved.", "[ YES ]", "[ NO ]"
- **Hint text** (line 382-387): "Esc: Close | Arrows: Navigate | Enter: Select" - may overflow on very narrow displays but canvas is fixed at 800px
- **Issue:** No dynamic content that could cause overflow. All text is static and fits within the 360px menu width.
- **Verdict:** No changes needed.

### 2. `src/scenes/minigame-selection/MinigameSelectionScene.ts`
**Status:** Medium risk - description text could overflow

- **Minigame name** (lines 237-243): `terminalBrightStyle` at x=100 (PADDING+40), no width constraint
- **Minigame description** (lines 261-267): `terminalDimStyle`, no wordWrap, positioned at x=100
- **Resource indicator** (lines 247-258): Right-anchored at `width - PADDING`, safe
- **Issue:** Long minigame descriptions (line 262: `summary.description`) have no wordWrap and could extend past the right edge. The available width is approximately 800 - 60*2 - 40 = 640px for descriptions.
- **Fix needed:** Add wordWrap to description text style with appropriate width constraint.

### 3. `src/ui/UpgradePanel.ts`
**Status:** Medium risk - name + level combination could overflow

- **Upgrade name** (lines 284-290): `terminalBrightStyle`, x=10, no width constraint
- **Level text** (lines 296-303): Positioned at `nameText.x + nameText.width + 15` - cascades overflow
- **Cost text** (lines 306-318): Right-anchored at `rowWidth - BUTTON_WIDTH - 20`, safe
- **Effect/description** (lines 321-334): Already has wordWrap with `wordWrapWidth: rowWidth - BUTTON_WIDTH - 40`, good
- **Issue:** Long upgrade names push level text ("Lv 3" or "OWNED") off the row. The name + level must fit within approximately `rowWidth - BUTTON_WIDTH - 30 - costWidth`.
- **Fix needed:** Either truncate upgrade names or use a max-width constraint. Consider using fixed positions for level and cost.

### 4. `src/scenes/main-menu/MainMenuScene.ts`
**Status:** High risk - player names can be any length

- **Slot labels** (lines 250-256): Format is `[Slot ${i + 1}] ${metadata.playerName || 'Unnamed'}` - player name up to 16 chars
- **Menu item text** (lines 277-286): Center-anchored at `centerX`, `terminalStyle`
- **Sub labels** (lines 289-299): "Last played: Xd ago", center-anchored, `terminalSmallStyle`
- **Issue:** Player names can be up to 16 characters (line 550). With slot prefix `[Slot 3] `, total could be ~26 chars. At 16px font with monospace, this is ~260px - should fit in 800px canvas but edge case.
- **Name input** (lines 344-351): 16 char limit enforced in code (line 550)
- **Verdict:** Theoretically safe due to 16-char limit, but worth validating. Low priority.

### 5. `src/ui/WelcomeBackModal.ts`
**Status:** Low risk - content is formulaic

- **Title** (lines 268-275): "WELCOME BACK" - static
- **Time away** (lines 296-307): Format like "8h 23m (max 8h)" - bounded length
- **Efficiency** (lines 311-325): Format like "50%" - bounded
- **Money earned** (lines 343-357): Uses `formatResource()` which handles large numbers
- **Modal width** (line 45): 400px with 24px padding = 352px content width
- **Issue:** Labels at x=contentX and values at x=contentX+120 leave only 232px for values. Large money values could overflow.
- **Fix needed:** Consider right-anchoring the value text or ensuring `formatResource` produces bounded output.

## Approach

1. **MinigameSelectionScene** - Add wordWrap to description text
   - Create a new TextStyle with wordWrap enabled
   - Set wordWrapWidth to container width minus padding

2. **UpgradePanel** - Constrain name + level layout
   - Option A: Truncate long names with ellipsis
   - Option B: Give name text a maxWidth and let level text position accordingly
   - Recommendation: Use Option A - calculate max name width and truncate

3. **WelcomeBackModal** - Right-anchor value text
   - Change value text anchors to (1, 0) for right alignment
   - Position at right edge of content area

4. **MainMenuScene** - Low priority, validate only
   - Current 16-char limit should prevent issues
   - Monitor during testing

## Files Likely Affected

- `src/scenes/minigame-selection/MinigameSelectionScene.ts` - Add wordWrap to description style
- `src/ui/UpgradePanel.ts` - Add name truncation helper, constrain text widths
- `src/ui/WelcomeBackModal.ts` - Right-anchor value text for better overflow handling

## Considerations

- PixiJS TextStyle wordWrap only works if set before text is created; may need to create inline styles
- Truncation with ellipsis requires manual implementation (substring + "...")
- Font is monospace (`Courier New`), so character width is predictable (~9.6px at 16px font size)
- All menus use the same text styles from `rendering/styles.ts` - changes should be local to avoid side effects
- Canvas size is fixed at 800x600, so max widths are deterministic

## Acceptance Criteria

- [ ] Minigame descriptions wrap within container bounds in MinigameSelectionScene
- [ ] Upgrade names do not push level/cost text outside row bounds in UpgradePanel
- [ ] Welcome back modal values do not overflow their column
- [ ] No text clips or overlaps in any menu under normal use cases
- [ ] Existing visual styling (colors, fonts, glow effects) preserved

---

## Next Agent to Invoke

**Agent:** `backend-implementation` (or `frontend-implementation` - this is all UI code)

**Context to provide:**
- Feature slug: `menu-text-overflow-fix`
- Tier: SMALL
- Sketch location: `.claude_docs/features/menu-text-overflow-fix/sketch.md`
- Primary files: MinigameSelectionScene.ts, UpgradePanel.ts, WelcomeBackModal.ts
- Canvas dimensions: 800x600 (fixed)

**Suggested Task Breakdown:**
1. **Task 1:** Fix MinigameSelectionScene description overflow - add wordWrap
2. **Task 2:** Fix UpgradePanel name/level overflow - add truncation
3. **Task 3:** Fix WelcomeBackModal value overflow - right-anchor values
4. **Task 4:** (Optional) Visual verification pass on all menus

Tasks 1-3 are independent and can be worked in parallel.

**After that agent completes:**
Manual testing should verify text displays correctly with:
- Long minigame descriptions
- Long upgrade names
- Large money values in welcome back modal
