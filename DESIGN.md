---
name: Cloudspace Custody Ledger
description: An institutional digital-asset custody register built for fast, controlled storage operations.
colors:
  ink: "#142033"
  ink-strong: "#081321"
  muted: "#657287"
  muted-strong: "#46556b"
  line: "#d9e1ea"
  line-strong: "#bcc8d6"
  surface: "#ffffff"
  surface-subtle: "#f7f9fb"
  canvas: "#edf1f5"
  navy: "#071525"
  navy-raised: "#0d2037"
  navy-line: "#203650"
  primary: "#2864c7"
  primary-dark: "#1d4fa4"
  primary-soft: "#eaf1fd"
  success: "#087e60"
  success-soft: "#e4f5ef"
  warning: "#a66208"
  warning-soft: "#fff4dc"
  danger: "#c43d4f"
  danger-soft: "#fcebed"
typography:
  display:
    fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(40px, 5vw, 68px)"
    fontWeight: 650
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 690
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 680
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  action: "8px"
  control: "9px"
  container: "12px"
  stage: "14px"
  pill: "999px"
spacing:
  hairline: "4px"
  compact: "8px"
  control: "12px"
  inset: "16px"
  section: "20px"
  spacious: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "38px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "38px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.navy-raised}"
    textColor: "{colors.surface}"
    rounded: "{rounded.container}"
    padding: "7px 10px"
    height: "52px"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "23px"
---

# Design System: Cloudspace Custody Ledger

## Overview

**Creative North Star: "The Custody Ledger"**

Cloudspace should feel like an institutional register for digital assets: controlled, auditable, and quick to scan. Deep navy establishes custody and scope; mineral-white work surfaces hold dense operational records; steel-blue rules and actions make structure unmistakable. The interface earns confidence through alignment, durable states, and precise hierarchy rather than decorative spectacle.

This is an Operate surface. High information density is intentional, but every screen must preserve a clear reading order: location and health, high-signal summary, then the ruled register or task form. The signature interaction is a stable preview stage that keeps the underlying register in context while loading, metadata, media, errors, and actions resolve progressively.

**Key Characteristics:**

- Deep navy navigation framing mineral-white operational surfaces.
- Dense ruled registers with aligned columns and tabular numerals.
- Steel-blue action color with emerald, amber, and red reserved for state.
- Disciplined corners, hairline borders, and elevation used only for separation.
- Short state transitions, progressive loading, and stable geometry.

## Colors

The palette is sober and mineral: navy carries institutional authority, cool whites and steel rules organize records, and semantic hues appear only when they communicate status or consequence.

### Primary

- **Custody Navy** (`navy`): the fixed navigation rail, login showcase, and other scope-defining surfaces.
- **Ledger Blue** (`primary`): primary actions, links, focus affiliation, and selected operational emphasis.
- **Pressed Ledger Blue** (`primary-dark`): hover and pressed emphasis for blue actions.
- **Registry Wash** (`primary-soft`): low-emphasis blue icon and status grounds.

### Secondary

- **Verified Emerald** (`success` / `success-soft`): healthy storage, successful operations, and verified connection states.
- **Exception Amber** (`warning` / `warning-soft`): recoverable warnings, storage exceptions, and folder cues.
- **Destructive Red** (`danger` / `danger-soft`): deletion, failed operations, and irreversible consequence.

### Neutral

- **Record Ink** (`ink`) and **Seal Ink** (`ink-strong`): body content and high-authority headings.
- **Steel Muted** (`muted`) and **Steel Strong** (`muted-strong`): metadata, secondary actions, and support copy.
- **Rule** (`line`) and **Rule Strong** (`line-strong`): row division, field boundaries, and major container edges.
- **Mineral White** (`surface`), **Ledger Paper** (`surface-subtle`), and **Cool Canvas** (`canvas`): the three-level work-surface stack.
- **Raised Navy** (`navy-raised`) and **Navy Rule** (`navy-line`): active navigation and dark-surface structure.

**The Semantic Reserve Rule.** Emerald, amber, and red communicate verified state, exception, and danger; never use them as arbitrary decoration.

**The Mineral Surface Rule.** Operational content stays on white or cool mineral surfaces. Gradients, glass effects, and colored card fields do not belong in the register.

## Typography

**Display Font:** Inter with system sans-serif fallbacks  
**Body Font:** Inter with system sans-serif fallbacks  
**Label/Mono Treatment:** Inter with uppercase tracking; numeric records use tabular figures

**Character:** The single-family system is neutral, compact, and precise. Weight, scale, tracking, and tabular figures create hierarchy without introducing a promotional display voice into operational screens.

### Hierarchy

- **Display** (650, responsive 40–68px, 0.98): reserved for the desktop login proposition; never use it inside the authenticated workspace.
- **Headline** (690, 26px desktop / 23px narrow mobile, 1.15): page identity and primary operational context.
- **Title** (680, 14px, 1.5): panel titles, modal titles, and compact empty-state headings.
- **Body** (400, 14px, 1.5): application baseline; long support copy should stay near 50–70 characters per line.
- **Label** (700, 10px, 0.08em): uppercase captions, table headings, section markers, and compact system labels. Repeated metadata may step down to 9–11px while preserving contrast.

**The Register Numeral Rule.** Counts, capacity, timestamps, and table numerics use tabular figures so changing values do not disturb column rhythm.

**The Operational Scale Rule.** Workspace typography stays compact. Large display type is a login-only expression, not a dashboard decoration.

## Layout

The desktop shell uses a fixed 264px navigation rail and a sticky 66px command bar. The workspace is centered at a maximum width of 1600px with 32px horizontal padding, 30px top padding, and a 20px vertical section rhythm. Summary ledgers use shared borders between cells; dense data lives in full-width tables rather than collections of floating cards.

Two-column operational layouts use an approximately 1.55:0.85 split and collapse to one column when width is constrained. Inputs and action groups remain adjacent to the records they affect. Tables retain their column model and scroll horizontally on narrow screens; a visible mobile hint explains the gesture instead of silently clipping actions.

### Responsive behavior

- **1180px and below:** soften dashboard proportions, reduce the login split, and take bucket collections from three to two columns.
- **960px and below:** move the fixed rail off-canvas behind a scrim, expose a 36px menu control, collapse major two-column layouts, and replace the login showcase with compact in-form branding.
- **760px and below:** use 15px page gutters, stack headings and toolbars, wrap actions, reorganize summary cells, enlarge repeated row actions to 44px touch targets, and present modals as bottom sheets.
- **560px and below:** hide secondary top-bar identity copy, move metrics to a single column, use 16px panel insets, and remove padding around the Drive panel so the register reaches its container edge.

**The Stable Register Rule.** Loading, empty, error, and preview states reserve meaningful height so records do not jump while network and media states resolve.

**The Context Before Action Rule.** Current location, storage health, and permission-dependent actions must be visible before the primary register begins.

## Elevation & Depth

The system is flat by default. Borders, surface tone, and shared rules carry most hierarchy. A small structural shadow (`shadow-sm`) separates persistent panels or hoverable custody cards from the canvas; a large overlay shadow (`shadow-lg`) is reserved for dropdowns and modal stages. Dark preview media sits on a navy-black stage, not on a decorative glow.

### Shadow Vocabulary

- **Structural Lift** (`0 2px 8px rgba(8, 19, 33, 0.06)`): quiet separation for panels, summary ledgers, and the mobile menu control.
- **Overlay Lift** (`0 24px 60px rgba(8, 19, 33, 0.2)`): modal and account-menu elevation only.
- **Toast Lift** (`0 14px 34px rgba(8, 19, 33, 0.18)`): transient notification separation.

**The Flat-by-Default Rule.** If a border or tonal change can explain hierarchy, do not add a shadow.

## Shapes

Corners are disciplined rather than severe. Compact icon actions use the 8px action radius; buttons, fields, and row glyphs use the 9px control radius; panels and custody cards use the 12px container radius; major overlay and summary stages may use 14px. Full pills are limited to badges, status capsules, progress tracks, and circular indicators.

Hairline borders are functional: they define register rows, cell groups, controls, and permission boundaries. Shared containers clip adjacent cells so metrics read as one ledger rather than separate cards.

**The Radius Hierarchy Rule.** Radius grows with container scale; never give a small control a softer silhouette than the surface containing it.

## Components

### Buttons

- **Shape:** compact control corners, 38px minimum height, 13px horizontal inset, and a 1px border.
- **Primary:** Ledger Blue with white text; darkens on hover and moves down 1px on active press.
- **Secondary:** white with a strong steel rule and dark steel text; hover uses Ledger Paper.
- **Quiet:** transparent at rest; acquires a subtle paper ground only on hover.
- **Danger:** solid Destructive Red and used only at the final destructive commitment point.
- **Focus / Disabled:** all buttons inherit the 3px visible focus ring with 2px offset; disabled actions retain layout and use reduced opacity with a non-interactive cursor.

### Chips

- **Style:** 23px minimum-height pills with compact 9–10px type and optional 6px state dot.
- **State:** neutral tags use Cool Canvas; success and danger variants use their semantic soft/strong pairs. A chip reports state; it is not ornamental decoration.

### Cards / Containers

- **Corner Style:** 12px for standard panels and custody cards; 14px for large ledger or modal stages.
- **Background:** Mineral White on Cool Canvas, with Ledger Paper for nested toolbars and table heads.
- **Shadow Strategy:** structural lift only when separation from the canvas is insufficient.
- **Border:** 1px Rule; use Rule Strong for high-authority table headers or modal edges.
- **Internal Padding:** 20px standard, 16px compact/mobile, and 24px for primary capacity emphasis.

### Inputs / Fields

- **Style:** white surface, strong steel border, 9px control radius, 40px minimum height, and 11px horizontal inset.
- **Focus:** shift the border to a lighter steel blue and add a 3px translucent Ledger Blue ring.
- **Error / Disabled:** explain the failure in text and use semantic red only around the affected state; never rely on color alone.

### Navigation

The fixed rail is deep navy. Items are 52px high with icon, 12px title, and 10px supporting detail. Default states are muted steel-blue; hover introduces a subtle raised navy field and border; active items use Raised Navy, a brighter navy border, and white title/icon. At 960px the rail becomes an off-canvas drawer with a scrim, and it closes after route changes.

### Ruled Register

Tables use tabular numerals, uppercase 9px headers, 10px × 12px header padding, 11px × 12px body-cell padding, and 1px row rules. Rows highlight with a very light paper tone on hover. File names and paths truncate independently; actions remain right-aligned. Large register rows use `content-visibility: auto` and an intrinsic row height to avoid rendering work outside the viewport.

### Progressive Preview Stage

Opening an object uses a stable dark stage with a 10px inner radius and a minimum height capped at 620px. A restrained shimmer holds the media geometry; the asset decodes asynchronously and fades in over 180ms when ready. One stale signed URL may be retried automatically, after which an explicit error and retry action replace the stage. Video preloads metadata, audio uses native controls, and document frames preserve a stable viewport.

### Feedback and Motion

Interactive state transitions run for 120–200ms. Rotation (700ms) and shimmer (1.25s) are reserved for genuine loading. Toasts and modals use brief entry motion and never delay access to the control. Under `prefers-reduced-motion: reduce`, animations and transitions collapse to 1ms and do not repeat.

### Accessibility and performance

Use semantic controls, programmatic labels for icon-only actions, `aria-expanded` on disclosure triggers, descriptive alternative text for object previews, and visible keyboard focus everywhere. Touch-heavy mobile controls are at least 44px. Preserve horizontal table access rather than hiding columns. Keep private media behind authorized URLs, decode large imagery asynchronously, preload only required media metadata, and never add effects that increase work across every register row.

## Do's and Don'ts

### Do:

- **Do** make location, storage health, permissions, and destructive consequences explicit before action.
- **Do** use shared rules, aligned columns, compact labels, and tabular numerals to make dense records scan quickly.
- **Do** preserve stable geometry through skeleton, empty, error, retry, and progressive-preview states.
- **Do** keep primary actions beside the records they affect and expose permission-gated actions only when available.
- **Do** verify keyboard focus, readable contrast, 44px mobile targets, reduced motion, and horizontal table access.
- **Do** use the documented tokens and semantic roles before introducing any one-off value.

### Don't:

- **Don't** turn the workspace into a field of floating generic SaaS cards, gradients, glass panels, or decorative glows.
- **Don't** use emerald, amber, or red for decoration; each color carries operational meaning.
- **Don't** hide critical register columns on mobile; preserve them through scrolling and a clear gesture cue.
- **Don't** introduce large promotional type, excessive whitespace, or slow theatrical motion inside authenticated operations.
- **Don't** expose private object URLs through public caching or trade permission clarity for visual convenience.
- **Don't** add a new radius, shadow, spacing value, or component variant when an existing token already expresses the hierarchy.
