---
name: ui-ux-pro-max
description: AI design intelligence skill for modern UI/UX design systems, Claymorphism 3D soft depth styling, responsive layout matrix, color palettes, fluid typography, and tactile component recipes.
---

# UI/UX Pro Max & Claymorphism Design Skill

This skill provides comprehensive design intelligence for building tactile, beautiful, **fully responsive**, and accessible user interfaces. It combines the multi-domain reasoning principles of **UI/UX Pro Max** with the soft depth aesthetics of **Claymorphism**.

---

## 1. Core Philosophy: Claymorphism & Tactile UI

Claymorphism is a soft 3D design style characterized by:
- **Subtle Dual Shadows:** A soft outer drop shadow paired with dual inner shadows (top-left highlight + bottom-right shade) to create an extruded, touchable look.
- **Generous Rounded Corners:** Chunky border-radii (`16px` to `24px` for cards, `9999px` for pill buttons and badges).
- **Vibrant Pastel Backdrops:** Light pastel gradients or deep dark meshes with smooth ambient illumination.
- **Playful Tactility:** Micro-interactions that depress on click (`transform: translateY(1px) scale(0.98)` with reduced inner shadow) and float on hover.

---

## 2. CSS Design Tokens Recipe

```css
:root {
  /* Surface & Canvas */
  --bg-canvas: #f0f4fd;
  --bg-gradient: radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #eef3fc 50%, #e3ecfa 100%);
  --surface-clay: #ffffff;
  --surface-clay-subtle: #f8fafc;
  --surface-clay-inset: #edf2f9;

  /* Clay Shadows */
  --clay-shadow-card:
    0 12px 28px -4px rgba(45, 62, 95, 0.08),
    0 4px 12px -2px rgba(45, 62, 95, 0.03),
    inset 0 2px 3px 0 rgba(255, 255, 255, 0.9),
    inset 0 -2px 3px 0 rgba(100, 116, 139, 0.06);

  --clay-shadow-card-hover:
    0 20px 36px -6px rgba(45, 62, 95, 0.12),
    0 6px 16px -2px rgba(45, 62, 95, 0.05),
    inset 0 2px 4px 0 rgba(255, 255, 255, 1),
    inset 0 -2px 4px 0 rgba(100, 116, 139, 0.08);

  --clay-shadow-button-primary:
    0 8px 16px -2px rgba(99, 102, 241, 0.35),
    0 3px 6px -1px rgba(99, 102, 241, 0.2),
    inset 0 2px 2px 0 rgba(255, 255, 255, 0.4),
    inset 0 -2px 3px 0 rgba(0, 0, 0, 0.15);

  --clay-shadow-input:
    inset 0 2px 4px 0 rgba(45, 62, 95, 0.06),
    inset 0 1px 2px 0 rgba(45, 62, 95, 0.04),
    0 1px 2px 0 rgba(255, 255, 255, 0.8);

  /* Fluid Responsive Typography */
  --font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
  --font-h1: clamp(24px, 4vw, 38px);
  --font-h2: clamp(18px, 2.5vw, 24px);
  --font-body: clamp(13.5px, 1.2vw, 15px);

  /* Brand Accents */
  --brand-primary: #6366f1;
  --brand-primary-hover: #4f46e5;
  --brand-tiktok: #000000;
  --brand-tiktok-accent: #fe2c55;
  --brand-youtube: #ff0000;
  --brand-facebook: #1877f2;

  /* Status Colors */
  --status-success-bg: #ecfdf5;
  --status-success-text: #065f46;
  --status-warning-bg: #fffbeb;
  --status-warning-text: #92400e;
  --status-danger-bg: #fef2f2;
  --status-danger-text: #991b1b;
  --status-info-bg: #eff6ff;
  --status-info-text: #1e40af;
}
```

---

## 3. Responsive UI Architecture (Standard Breakpoints & Rules)

Hệ thống thiết kế yêu cầu đáp ứng hoàn hảo trên 4 tầng thiết bị chính:

| Màn hình | Breakpoint | Hành vi Layout | Yêu cầu tương tác |
|---|---|---|---|
| **Mobile** | `< 640px` (375px–480px) | Single column layout (`grid-template-columns: 1fr`), full-width forms, horizontal table scrolling | Min tap target **44x44px**, padding `16px`, text `clamp()`, stacked buttons |
| **Tablet Portrait** | `640px - 768px` | 2-column forms, stacked dashboard cards, auto-fit platform grid | Padding `20px`, touch-friendly dropdowns & selects |
| **Tablet Landscape** | `768px - 1024px` | 2-column dashboard (Forms + Import side-by-side or stacked) | Responsive tables with flexible column widths |
| **Desktop / Wide** | `> 1024px` (1280px–1560px) | Full multi-column dashboard, sticky sidebar/cards, expanded data tables | Padding `32px - 40px`, max-width `min(1560px, calc(100% - 40px))` |

### 3.1 Quy tắc Responsive chi tiết:

1. **Fluid Typography (Không fix cứng px cố định):**
   - Sử dụng hàm `clamp(min, preferred, max)` cho tiêu đề, hero header và khoảng cách padding lớn để tự co giãn mượt mà theo viewport mà không bị vỡ dòng.
2. **Auto-Reflow & Stacked Grids:**
   - Dùng CSS Grid với `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` cho danh sách thẻ nền tảng (Platform Options) để tự chuyển từ 3 cột (Desktop) -> 1 cột (Mobile).
3. **Safe Scroll & Overflow Tables:**
   - Các bảng dữ liệu phức tạp (như danh sách video, log jobs) luôn bọc trong container `overflow-x: auto` với `-webkit-overflow-scrolling: touch` để không tràn khung trang trên điện thoại.
4. **Mobile Touch Target & Ergonomics:**
   - Tất cả nút bấm, checkbox, input và clickable areas phải đạt chiều cao tối thiểu **44px** trên màn hình cảm ứng để người dùng bấm ngón tay dễ dàng mà không bị trượt.
5. **No Horizontal Scrollbar (Zero Overflow):**
   - Luôn sử dụng `box-sizing: border-box`, `width: 100%`, `min-width: 0` trên flex & grid children để tránh horizontal overflow layout shifts.

---

## 4. Component Design Rules

### 4.1 Clay Cards
- Border: `1px solid rgba(255, 255, 255, 0.8)`
- Background: pure white `#ffffff` hoặc translucent clay `#ffffffeb` với `backdrop-filter: blur(12px)`.
- Smooth transition on hover: `transform: translateY(-2px)` với expanded shadow.

### 4.2 Form Inputs & Controls
- Inset shadow tạo cảm giác chìm nhẹ tự nhiên.
- Glowing focus ring: `box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2)`.
- Segmented pills hoặc card selectors cho các lựa chọn nền tảng, có highlight nổi bật khi selected.

### 4.3 Buttons & CTAs
- Pill shape (`border-radius: 9999px`) hoặc rounded rectangular (`border-radius: 12px`).
- Bold gradient backgrounds (`linear-gradient(135deg, ...)`) với chữ trắng tương phản cao.
- Active click state: `transform: translateY(1px) scale(0.98)`.

### 4.4 Status Badges
- Pill shape với border tinh tế, pastel background, và chấm trạng thái có pulse animation cho tác vụ đang chạy.

---

## 5. Pre-Delivery Checklist
- [x] **Responsive Matrix:** Đã test trên Mobile (375px), Tablet (768px), Desktop (1280px+).
- [x] **Touch Ergonomics:** Nút bấm và vùng chạm đạt chuẩn tối thiểu 44x44px.
- [x] **Contrast:** Độ tương phản văn bản đạt chuẩn WCAG AA 4.5:1 tối thiểu.
- [x] **Zero Layout Shifts:** Không bị horizontal scroll ngoài ý muốn (`min-width: 0`, `overflow-x: hidden/auto`).
- [x] **Interactive Feedback:** Có `cursor: pointer`, hiệu ứng `:hover`, `:active`, và `:focus-visible`.

CLAYMORPHISM.md — design spec for AI agents
Follow these tokens verbatim. Do not improvise colors or shadows.

== 1. Color tokens (use these hex values, no substitutes) ==
Backgrounds
  --bg-app:      #F7F5FB  /* tinted near-white, never pure #FFF */
  --bg-raised:   #FFFFFF  /* only for floating sheets over --bg-app */
Surfaces (the clay itself, pick by semantic role)
  --surface-lavender: #B8A6FF  /* primary cards, hero blocks */
  --surface-sky:      #9EC9F0  /* info, secondary cards */
  --surface-mint:     #7DD4A8  /* success, positive stats */
  --surface-peach:    #FFB59E  /* warm cards, highlights */
  --surface-pink:     #F5B8D0  /* accent, playful cards */
  --surface-lemon:    #F5D77A  /* attention rows, badges */
Actions & status (saturated, reserved for intent)
  --action-primary:   #FF7A6B  /* coral: confirm, start, play */
  --action-on:        #FFFFFF  /* label on coral, ratio >= 4.5 */
  --status-active:    #7DD4A8  /* green pill */
  --status-pending:   #F5D77A  /* yellow pill */
  --status-archived:  #C9B5FF  /* muted lavender pill */
Text
  --text-strong:  #2E2A3F  /* headings, never pure black */
  --text-muted:   #6B6580  /* captions, secondary labels */

Rule: one saturated --action-* per screen as the hero CTA.
Surfaces carry the mood; actions carry the verb.

== 2. Radius tokens (chunky is the brand) ==
  --r-card:   28px   /* range 24-32 by card size */
  --r-button: 18px   /* range 16-20 */
  --r-chip:   999px  /* pills are fully round, not 12px */
  --r-input:  16px
  --r-icon:   20px   /* squircle app-icon tiles */
Never drop below 16px on interactive elements, or the soft
shadow reads as a flat drop-shadow instead of molded clay.

== 3. Spacing & sizing scale (8pt grid) ==
  4 / 8 / 12 / 16 / 24 / 32 / 48
  Card padding: 24 (compact) to 28 (default)
  Gap between clay siblings: 16 min (shadows need breathing room)
  Tap target: 48x48 min, button height 52-56

== 4. The shadow recipe (the whole look lives here) ==
Every clay surface = 3 stacked shadows, all keyed to its own hue:
  box-shadow:
    8px 8px 24px rgba(H, 0.35),          /* colored drop, SE */
    -8px -8px 24px rgba(255,255,255,0.6),/* light lift, NW */
    inset 4px 4px 8px rgba(255,255,255,0.5),  /* top-left sheen */
    inset -6px -6px 12px rgba(H, 0.30);  /* bottom-right depth */
H = the surface's OWN color darkened ~15%, never gray.
  lavender surface -> shadow rgba(140,108,255,..)
  coral button     -> shadow rgba(255,90,75,..)
Light always comes from top-left; depth pools bottom-right.
Keep it consistent across the entire screen.

Elevation levels (do not stack clay on clay beyond level 2):
  L0 flat tint     : no shadow, just --bg-app
  L1 resting card  : recipe above at full strength
  L2 floating sheet: same recipe, drop offset 12px, blur 32px

== 5. Component recipes ==
Button (primary):
  bg --action-primary, label --action-on bold 16,
  radius --r-button, height 54, padding 0 24,
  shadow recipe keyed to coral,
  :active -> transform scale(0.97) + all shadow offsets halve
  (the squish: it sinks into the page, not just smaller)
Button (secondary):
  bg --surface-lavender or white, label --text-strong,
  same geometry, softer shadow strength (0.25)
Card:
  bg a --surface-*, radius --r-card, padding 24-28,
  full shadow recipe, one heading + content, no inner borders
Chip / status pill:
  radius 999, padding 6 14, height 28-32,
  bg the matching --status-*, label --text-strong 13 semibold,
  shadow at half strength (chips are small, keep it subtle)
Toggle switch:
  track 52x32 radius 999, off=--bg-app inset shadow,
  on=--surface-sky, thumb white 26px with tiny clay shadow
Input:
  bg --bg-app, radius --r-input,
  INSET shadow only (pressed-inward well), no outer drop,
  inset 3px 3px 8px rgba(H,0.2), inset -3px -3px 8px #FFF
Bottom nav bar:
  bg white, radius --r-card on top corners or floating pill,
  active item -> coral icon + label, inactive --text-muted,
  one clay shadow lifting the whole bar
App-icon tile:
  squircle --r-icon, single --surface-* fill,
  full recipe, optional 3D glyph centered

== 6. Typography ==
  Family: rounded sans — Quicksand, Nunito, Outfit, Fredoka
  Weights: 500 body, 600 labels, 700 headings (chunky to match)
  Sizes: h1 28-32, h2 22, body 16 (min), caption 13
  Letter-spacing: 0.01em body, tighten headings to 0
  Line-height: 1.4 body, 1.2 headings

== 7. Do ==
  - Match every shadow color to its surface hue
  - Keep light source top-left on the entire screen
  - Use exactly one --action-* CTA per view
  - Give each clay element 16px+ of breathing room
  - Pair chunky radii with chunky bold type

== 8. Don't (the mistakes agents repeat) ==
  - Gray/neutral shadows — kills the molded feel instantly
  - Radius under 16 on buttons — reads as flat-with-shadow
  - Pure #FFF page background — erases the soft tinted glow
  - Skipping the inset top-left sheen — surface looks stuck flat
  - Stacking clay on clay 3+ deep — turns to mush
  - Sharp grotesk fonts (Inter, Helvetica) fighting the round mood
  - Multiple saturated CTAs competing on one screen

== 9. When to use / avoid ==
  Use:   onboarding, kids & education, friendly fintech, savings
         apps, 3D landing pages, empty states, celebratory moments
  Avoid: dense data tables, analytics dashboards, enterprise
         tools, anything text-heavy or high-density
