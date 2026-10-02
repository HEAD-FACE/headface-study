# Original User Request

## 2026-10-01T05:04:57Z

This is a single self-contained fix; keep it small and focused. Redesign the subject cards on HEADFACE STUDY by replacing bitmap photos, vignette shadows, and tint overlays with a clean minimalist pastel theme and thoughtful, handcrafted SVG illustrations for all 10 subjects.

Working directory: c:\Users\ASUS\OneDrive\Documents\GitHub\headface-study
Integrity mode: development

## Requirements

### R1. Minimalist Pastel Card Theme
- Remove the existing bitmap photos (`.subject-card-bg`), dark vignette shadows, and heavy tint overlays from all subject cards in both `index.html` and `subject.html`.
- Apply a clean, modern pastel color palette (soft mint, sky blue, lavender, pastel rose, gentle amber, etc.) with matching subtle 3D game borders that enhance contrast and readability.

### R2. Handcrafted & Accurate Subject SVGs
- Embed custom, thoughtful SVG vector illustrations directly onto the background of each subject card:
  1. **วิทยาศาสตร์พื้นฐาน (Science)**: Laboratory glassware (Erlenmeyer flask / beaker / test tubes) with subtle liquid levels & bubbles.
  2. **คณิตศาสตร์พื้นฐาน (Math)**: Geometric compass, protractor, function curve, and clean mathematical symbols (\(\pi\), \(\Sigma\), \(\sqrt{}\)).
  3. **ภาษาอังกฤษพื้นฐาน (English)**: Open dictionary / book, speech bubble with phonetic or vocabulary elements, fountain pen / globe.
  4. **ภาษาไทยพื้นฐาน (Thai)**: Traditional palm-leaf manuscript (สมุดข่อย) / Thai literature quill / decorative motif.
  5. **สังคมศึกษาฯ (Social Studies)**: Globe with meridian lines, scale of justice, architectural dome.
  6. **ประวัติศาสตร์ (History)**: Ancient parchment scroll, hourglass, historical artifact / ancient temple pillar.
  7. **สุขศึกษาและพลศึกษา (Health & PE)**: Heartbeat pulse line (ECG), whistle / sports equipment.
  8. **ศิลปะ ดนตรีฯ (Arts & Music)**: Artist paint palette with brushes and musical notation (treble clef, notes).
  9. **การงานอาชีพ (Career & Tech)**: Mechanical gear / wrench paired with a growing plant seedling.
  10. **เทคโนโลยี/วิทยาการคำนวณ (Computing)**: Monitor / terminal with code brackets (`</>`), clean circuit trace lines, binary hints.
- SVGs must have precise stroke weights, harmonious opacity/color matching the pastel theme, and non-intrusive placement so text remains prominent.

### R3. Flawless Typography & Readability
- Ensure all typography (title, subtitle, lesson count, progress percentage) has high contrast and is effortlessly legible without harsh drop shadows.
- Maintain responsive behavior across mobile and desktop, interactive hover/active states, and Barba.js page transitions.

## Acceptance Criteria

### Visual & Readability
- [ ] No bitmap images (`.webp`/`.png`), dark vignettes, or dark overlays remain on subject cards.
- [ ] Each of the 10 subjects features a unique, carefully composed SVG illustration that accurately represents the discipline.
- [ ] Card text is crisp, clear, and comfortably readable on all devices.

### Code Quality & Integrity
- [ ] SVGs are valid, clean vector paths with zero rendering errors.
- [ ] Tag balance and Barba.js transitions remain 100% functional.
- [ ] Both `index.html` (top 6 subjects) and `subject.html` (all 10 subjects) are updated consistently.
