# Design System — Multi-AI Workspace
> Derived from the Dermadry AIBIS brand identity. This file is the single source of truth for all UI decisions in this web app.

---

## Brand Colors

```css
:root {
  /* Core palette */
  --color-navy:      #275D89;   /* Primary — sidebars, headers, active nav, CTAs */
  --color-teal:      #50C4CF;   /* Accent — highlights, badges, focus rings, active states */
  --color-white:     #FFFFFF;   /* Page background, card backgrounds */
  --color-gold:      #d9b800;   /* Reserved — milestone badges, pinned/starred items only */

  /* Neutral scale */
  --color-gray-50:   #F7F9FC;   /* App shell background (not pure white) */
  --color-gray-100:  #EEF1F6;   /* Dividers, input backgrounds */
  --color-gray-200:  #DDE1E7;   /* Borders */
  --color-gray-400:  #9AA3B0;   /* Placeholder text, disabled states */
  --color-gray-600:  #5A6374;   /* Secondary labels */
  --color-gray-900:  #1A2130;   /* Body text, headings */

  /* Semantic */
  --color-success:   #2ECC9A;
  --color-warning:   #F5A623;
  --color-error:     #E04B4B;
  --color-info:      var(--color-teal);
}
```

### Usage rules
- Navy is the dominant structural color: sidebar, top nav, primary buttons, section headers.
- Teal is always secondary — never use teal as a background at full opacity on large surfaces.
- White is the card and panel background. The app shell uses `--color-gray-50`.
- Gold is a privilege color. Only use it on starred conversations, record usage metrics, or pinned AI agents.
- Never mix Navy and Gold on the same element.

---

## Typography

**Font family: Montserrat only.**

```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

```css
:root {
  --font: 'Montserrat', sans-serif;

  /* Scale */
  --text-xs:   0.75rem;   /* 12px — labels, timestamps, badges */
  --text-sm:   0.875rem;  /* 14px — sidebar items, input text, metadata */
  --text-base: 1rem;      /* 16px — body, chat messages */
  --text-lg:   1.125rem;  /* 18px — subheadings, section titles */
  --text-xl:   1.375rem;  /* 22px — page headings */
  --text-2xl:  1.75rem;   /* 28px — modal titles, hero headings */
  --text-3xl:  2.25rem;   /* 36px — landing/marketing headings */

  /* Weight */
  --weight-light:    300;
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;
  --weight-extrabold: 800;

  /* Line height */
  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-loose:  1.75;   /* Long-form content, chat bubbles */
}
```

### Typography rules
- All text is Montserrat. No fallbacks with different aesthetics.
- Page headings: `700`, `--text-xl` or `--text-2xl`.
- Sidebar labels: `500`, `--text-sm`.
- Chat messages / prose: `400`, `--text-base`, `--leading-loose`.
- Timestamps and metadata: `400`, `--text-xs`, `--color-gray-400`.
- Never use `font-weight: 900` in the app UI (reserved for marketing pages only).

---

## Spacing

```css
:root {
  --space-1:  0.25rem;   /*  4px */
  --space-2:  0.5rem;    /*  8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
}
```

### Spacing rules
- Use the scale exclusively. No arbitrary pixel values.
- Internal element padding (buttons, inputs, list items): `--space-2` to `--space-4`.
- Section padding within panels: `--space-6` to `--space-8`.
- Page-level gutters: `--space-6` on mobile, `--space-10` on desktop.

---

## Layout

### App shell

```
┌──────────────────────────────────────────────┐
│  Top Nav (64px, Navy)                        │
├─────────────┬────────────────────────────────┤
│  Sidebar    │  Main Content Area             │
│  (240px,    │  (fluid, gray-50 bg)           │
│   white)    │                                │
│             │                                │
└─────────────┴────────────────────────────────┘
```

```css
:root {
  --sidebar-width:    240px;
  --sidebar-collapsed: 64px;
  --topnav-height:     64px;
  --content-max-width: 860px;   /* Constrain prose/chat columns */
  --panel-max-width:  1200px;   /* Wide panels (agent grid, settings) */
}
```

- The sidebar is white with a `1px solid var(--color-gray-200)` right border. No shadow.
- The top nav is Navy (`#275D89`) with white text and icons.
- The main content area sits on `--color-gray-50`, not pure white.
- Chat or editor columns use `--content-max-width: 860px` centered within the content area.
- Agent/model grid views use `--panel-max-width: 1200px`.

### Grid

Use a 12-column grid for page-level layouts.

```css
.grid-12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--space-6); }
.col-3  { grid-column: span 3; }
.col-4  { grid-column: span 4; }
.col-6  { grid-column: span 6; }
.col-8  { grid-column: span 8; }
.col-12 { grid-column: span 12; }
```

---

## Borders & Radius

```css
:root {
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;   /* Pills, avatars */

  --border-color: var(--color-gray-200);   /* #DDE1E7 */
  --border:       1px solid var(--border-color);
}
```

### Border rules
- Use full borders (`1px solid var(--border-color)`) or no border. Never single-sided colored borders.
- Never use a Navy, Teal, or Gold border as a decorative accent strip.
- Cards and panels: `--radius-md` (8px).
- Buttons: `--radius-md` (8px), or `--radius-full` for pill-style action buttons.
- Inputs: `--radius-md` (8px).
- Avatars and model icons: `--radius-full`.

---

## Elevation — No Shadows

**Box shadows are not used anywhere in this design system.**

Depth and hierarchy are expressed through:
- Background color contrast (`--color-white` on `--color-gray-50`)
- Border (`1px solid var(--border-color)`)
- Navy structural elements (sidebar, nav, banners)

If a floating element is required (dropdown, tooltip, modal), use:
```css
/* Only acceptable exception — overlaying UI only */
.overlay { border: var(--border); background: var(--color-white); }
```

---

## Components

### Buttons

```css
/* Primary — Navy fill */
.btn-primary {
  background:    var(--color-navy);
  color:         var(--color-white);
  font-family:   var(--font);
  font-weight:   var(--weight-semibold);
  font-size:     var(--text-sm);
  padding:       var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  border:        none;
  cursor:        pointer;
}
.btn-primary:hover  { background: #1f4d76; }
.btn-primary:focus  { outline: 2px solid var(--color-teal); outline-offset: 2px; }

/* Secondary — outlined */
.btn-secondary {
  background:    transparent;
  color:         var(--color-navy);
  border:        1px solid var(--color-navy);
  font-weight:   var(--weight-semibold);
  font-size:     var(--text-sm);
  padding:       var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
}
.btn-secondary:hover { background: var(--color-gray-50); }

/* Ghost — minimal */
.btn-ghost {
  background:    transparent;
  color:         var(--color-gray-600);
  border:        none;
  font-size:     var(--text-sm);
  padding:       var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
}
.btn-ghost:hover { background: var(--color-gray-100); color: var(--color-gray-900); }

/* Accent — Teal (use sparingly) */
.btn-accent {
  background:    var(--color-teal);
  color:         var(--color-white);
  font-weight:   var(--weight-semibold);
  font-size:     var(--text-sm);
  padding:       var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  border:        none;
}
```

### Inputs

```css
.input {
  font-family:   var(--font);
  font-size:     var(--text-sm);
  color:         var(--color-gray-900);
  background:    var(--color-white);
  border:        1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding:       var(--space-2) var(--space-4);
  width:         100%;
  outline:       none;
}
.input:focus  { border-color: var(--color-teal); }
.input::placeholder { color: var(--color-gray-400); }
```

### Cards / Panels

```css
.card {
  background:    var(--color-white);
  border:        var(--border);
  border-radius: var(--radius-lg);
  padding:       var(--space-6);
  /* No box-shadow */
}
```

### Badges

```css
.badge {
  display:       inline-flex;
  align-items:   center;
  font-size:     var(--text-xs);
  font-weight:   var(--weight-semibold);
  padding:       var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
}
.badge-navy   { background: var(--color-navy);    color: var(--color-white); }
.badge-teal   { background: rgba(80,196,207,0.15); color: var(--color-teal); }
.badge-gold   { background: rgba(217,184,0,0.15);  color: var(--color-gold); }  /* milestone only */
.badge-gray   { background: var(--color-gray-100); color: var(--color-gray-600); }
```

### Sidebar navigation items

```css
.nav-item {
  display:       flex;
  align-items:   center;
  gap:           var(--space-3);
  padding:       var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size:     var(--text-sm);
  font-weight:   var(--weight-medium);
  color:         var(--color-gray-600);
  cursor:        pointer;
}
.nav-item:hover  { background: var(--color-gray-50); color: var(--color-gray-900); }
.nav-item.active {
  background: rgba(39, 93, 137, 0.08);
  color:      var(--color-navy);
  font-weight: var(--weight-semibold);
}
```

### Top navigation

```css
.topnav {
  height:          var(--topnav-height);
  background:      var(--color-navy);
  display:         flex;
  align-items:     center;
  padding:         0 var(--space-6);
  gap:             var(--space-4);
  /* Logo left, actions right */
}
.topnav-link {
  color:       rgba(255, 255, 255, 0.75);
  font-size:   var(--text-sm);
  font-weight: var(--weight-medium);
}
.topnav-link:hover  { color: var(--color-white); }
.topnav-link.active { color: var(--color-white); font-weight: var(--weight-semibold); }
```

### Tooltips

```css
.tooltip {
  background:    var(--color-navy);
  color:         var(--color-white);
  font-family:   var(--font);
  font-size:     var(--text-xs);
  font-weight:   var(--weight-medium);
  padding:       var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  pointer-events: none;
}
```

### Dividers

```css
.divider {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: var(--space-4) 0;
}
```

---

## Icons

- Inline SVG paths only. No icon fonts, no external CDN icon libraries.
- Icons are not decoration — every icon must communicate something.
- Max 4 to 6 unique icons per view.
- Icon color inherits from parent (`currentColor`) unless explicitly overriding.
- Standard sizes: `16px` (inline, labels), `20px` (buttons, nav items), `24px` (standalone actions).

---

## AI Agent / Model Cards

For the agent grid or model selection UI:

```css
.agent-card {
  background:    var(--color-white);
  border:        var(--border);
  border-radius: var(--radius-lg);
  padding:       var(--space-5) var(--space-6);
  display:       flex;
  flex-direction: column;
  gap:           var(--space-3);
}
.agent-card:hover { border-color: var(--color-teal); }
.agent-card.active {
  border-color: var(--color-navy);
  background:   rgba(39, 93, 137, 0.04);
}
.agent-card.pinned { /* Gold treatment — use sparingly */
  border-color: var(--color-gold);
}
```

---

## States

| State | Treatment |
|---|---|
| Default | Navy fills, gray borders, white backgrounds |
| Hover | Slightly lighter navy fill or gray-50 background tint |
| Focus | `2px solid var(--color-teal)` outline, `outline-offset: 2px` |
| Active / Selected | Navy border + navy-tinted background (`rgba(39,93,137,0.06)`) |
| Disabled | Opacity `0.4`, `cursor: not-allowed` |
| Error | `var(--color-error)` border, no fill change |
| Loading | Navy-to-teal animated gradient or a spinner in Navy |

---

## Responsive breakpoints

```css
/* Mobile-first */
--bp-sm:  480px;
--bp-md:  768px;   /* Sidebar collapses to icon-only */
--bp-lg:  1024px;  /* Full sidebar visible */
--bp-xl:  1280px;  /* Wide panel layouts unlock */
```

- Below `--bp-md`: sidebar is hidden behind a hamburger trigger.
- Between `--bp-md` and `--bp-lg`: sidebar shows icons only (`--sidebar-collapsed: 64px`).
- Above `--bp-lg`: full sidebar with labels.

---

## What not to do

- No `box-shadow` anywhere.
- No single-sided colored borders (no `border-left: 3px solid var(--color-teal)` accent strips).
- No card-on-card nesting with elevation differences.
- No off-white backgrounds (`#fafafa`, `#f5f5f5`). Use `--color-gray-50` (`#F7F9FC`) or `--color-white` only.
- No fonts other than Montserrat.
- No Gold on structural elements — Gold is a status signal, not a theme color.
- No teal as a primary action color in the nav or CTAs (that is Navy's job).