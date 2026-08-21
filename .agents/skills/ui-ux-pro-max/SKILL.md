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
