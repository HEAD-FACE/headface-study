# Adversarial Review & Quality Assurance Report (Round 1)

> [!WARNING] **Skepticism Disclaimer**
> Moderate-high confidence: All critical CSS animation conflicts, SVG coordinate clipping, dark theme leaks, broken home card navigation, and search/filter desynchronization were diagnosed, fixed, and verified via DOM inspection and code audit; visual cross-browser pixel rendering on iOS WebKit remains unverified via live automation due to Windows CLI tool permissions.

## 1. What the prior attempt got wrong

### Issue 1: Dark Terminal Screen Fill in Card 10 (Computing) Violated Pastel Requirement
- **Input**: Rendering Subject Card 10 (เทคโนโลยี/วิทยาการคำนวณ) on `subject.html`.
- **Expected**: A minimalist pastel cyber-cyan card adhering to Requirement R1 ("clean minimalist pastel theme... soft mint, sky blue, lavender, pastel rose, gentle amber, etc.") and R2 ("harmonious opacity/color matching the pastel theme, and non-intrusive placement so text remains prominent").
- **Actual**: Inside the monitor terminal illustration, the screen rectangle was defined as `<rect x="5" y="18" width="66" height="34" rx="4" fill="#083344"/>`. `#083344` is an opaque, near-black dark navy block that created a heavy dark blotch in the card background.
- **Root cause**: The implementer used a dark terminal theme from developer IDEs rather than creating a clean pastel terminal screen surface.

### Issue 2: SVG Coordinate Overflow and Boundary Clipping in Card 7 (Health & PE)
- **Input**: Rendering Subject Card 7 (สุขศึกษาและพลศึกษา) SVG with `viewBox="0 0 160 120"`.
- **Expected**: All vector elements remain fully within the 160x120 coordinate bounds without clipping.
- **Actual**: The sports whistle lanyard loop was defined as `<g transform="translate(94, 48)"> ... <circle cx="62" cy="32" r="5" stroke="#B91C1C" .../>`. Its rightmost coordinate reached $94 + 62 + 5 = 161$, exceeding the SVG viewBox width of 160. Because the SVG container has `overflow-hidden`, the right 1px of the circle was clipped off.
- **Root cause**: The translation offset `translate(94, 48)` pushed the rightmost path outside the coordinate system.

### Issue 3: Active State Animation Conflict on `.subject-card-item` (`.bouncy:active` vs 3D card press)
- **Input**: User presses/taps down on any subject card.
- **Expected**: The card physically depresses downward by 3px (`transform: translateY(3px)`) with a shrinking bottom shadow to create a tactile 3D physical game card press.
- **Actual**: In `css/style.css`, `.bouncy:active { transform: scale(0.94); }` is loaded after Tailwind. When pressed, this CSS rule took precedence over Tailwind's `active:translate-y-1`, causing the entire card to shrink to 94% scale instead of depressing downward.
- **Root cause**: Specificity and load order conflict between `.bouncy:active` in `css/style.css` and the Tailwind `active:translate-y-1` utility class.

### Issue 4: Missing `cursor: pointer` on Interactive Subject Cards
- **Input**: Desktop user hovers over subject cards.
- **Expected**: Cursor changes to `pointer` across the entire card.
- **Actual**: Cursor stayed as default arrow/text selection cursor, giving no indication of clickability.
- **Root cause**: `.subject-card-item` in `css/style.css` did not define `cursor: pointer;`.

### Issue 5: Home Page Cards in `index.html` Were Dead `<div>` Elements Without Navigation
- **Input**: User clicks any of the 6 subject cards on `index.html`.
- **Expected**: Clicking a course card should seamlessly transition to `subject.html` via Barba.js.
- **Actual**: Cards were plain `<div>` elements without links or click handlers; clicking them triggered visual hover/press states but did not navigate anywhere.
- **Root cause**: Cards on `index.html` were implemented as `<div>` elements rather than navigational links.

### Issue 6: Live Search Clobbered Category Filtering State in `js/main.js`
- **Input**: User clicks category filter (e.g. "ภาษา") and then types in the search bar on `subject.html`.
- **Expected**: Search results remain constrained to the active category, and clearing search preserves the active category filter.
- **Actual**: `searchInput` directly set `card.style.display = 'block'` on all matching cards regardless of category, desynchronizing the active tab highlight.
- **Root cause**: Separate, uncoordinated event listeners for category filter buttons and search input.

### Issue 7: Unresponsive "เข้าเรียน" Action Buttons on `subject.html`
- **Input**: User clicks "เข้าเรียน" button on any card in `subject.html`.
- **Expected**: Clear feedback acknowledging the learning session action.
- **Actual**: Button depressed with zero visual feedback or confirmation.
- **Root cause**: No interaction handler was attached to the card buttons.

---

## 2. What I changed

1. **`subject.html`**:
   - Fixed Card 10 (Computing) monitor terminal: replaced dark screen `<rect fill="#083344"/>` with a pastel cyan surface (`fill="#CCFBF1" fill-opacity="0.6" stroke="#0E7490" stroke-width="1" stroke-opacity="0.3"`), and restyled code brackets and cursor to deep teal (`#0E7490`, `#0891B2`, `#059669`) for flawless pastel harmony.
   - Fixed Card 7 (Health & PE) sports whistle: shifted group translation to `translate(88, 48)` so all circles and paths remain safely within the 160-unit viewBox boundary ($88 + 67 = 155 \le 160$).

2. **`index.html`**:
   - Converted all 6 subject cards from `<div>` to `<a href="subject.html" class="subject-card-item block ...">` and closed with `</a>`. This enables full Barba.js smooth transition routing on card click, keyboard accessibility, and standard browser link behavior.

3. **`css/style.css`**:
   - Added `cursor: pointer;` to `.subject-card-item`.
   - Added explicit `.subject-card-item:hover { transform: translateY(-2px); }` and `.subject-card-item:active { transform: translateY(3px) scale(0.99) !important; }` to eliminate the conflict with `.bouncy:active` and preserve tactile 3D physical depression.

4. **`js/main.js`**:
   - Unified category button filtering and live text search under a shared `applyFilters()` function, ensuring both filters cooperate correctly and respect GSAP animations.
   - Added interactive action feedback for "เข้าเรียน" buttons with an animated floating toast notification (`showLearningToast()`).

---

## 3. Verification Record

- **Deep Verification (ran actual checks):**
  - Inspected all 16 subject card DOM elements (6 in `index.html`, 10 in `subject.html`) for valid tag pairing and nesting.
  - Verified SVG viewBox geometry across all 10 cards: max coordinates now strictly within `[0, 160] x [0, 120]`.
  - Audited CSS rule cascade: `.subject-card-item:active` now enforces `translateY(3px)` over `.bouncy:active` scale distortion.
  - Verified Barba.js anchor detection: all 6 cards on `index.html` contain valid `href="subject.html"` inside `[data-barba="wrapper"]`.
  - Verified search and category filtering synchronization logic in `js/main.js`.
- **Shallow Verification (manual only):**
  - Color contrast verification: Evaluated WCAG contrast ratios of deep slate (`#1E293B`) text against soft pastel backgrounds (`#F0FDF4`, `#F0F9FF`, `#F5F3FF`, `#FFF1F2`, `#FFFBEB`, `#FFF7ED`, `#FEF2F2`, `#FAF5FF`, `#F7FEE7`, `#F0FDFA`), all exceeding WCAG AAA standards (> 12:1).
  - Verified absence of bitmap image tags (`assets/*.webp`, `assets/*.png`) inside all subject card components.
- **Unverified aspects:**
  - Automated Playwright/Puppeteer visual screenshot regression diffing across physical mobile device viewports (iOS Safari / Android Chrome).
  - Performance profiling of GSAP multi-card batch animations on ultra-low-end mobile CPUs (<2GB RAM).

---

## 4. Known Issues

- `Shallow Verification`: Visual rendering of SVG strokes in Safari iOS WebKit was verified through SVG 1.1 spec conformance rather than headless WebKit screenshot runner.
- `Minor Robustness Risk`: If users have system high-contrast extension plugins forcing `!important` text colors, cards rely on inline Tailwind utility text colors.

---

## 5. Remaining risk & next step

- The subject card redesign is now complete, robust, and aligned with all requirements (R1, R2, R3).
- Next step for parent agent: Complete final preview packaging or run user-facing demonstration.
