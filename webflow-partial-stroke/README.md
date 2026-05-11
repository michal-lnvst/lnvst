# Webflow Partial Stroke (Separate CSS + JS)

This mini project contains two files for your `.blog_image_wrapper` effect:

- `partial-stroke.css`
- `partial-stroke.js`

## What It Does

- Draws a **partial border stroke** (not full rectangle)
- Stroke is visually **centered on path** (Figma-like center stroke)
- Starts near top-right and ends around middle-bottom by default
- Supports combo classes like `.is-3px`, `.is-4px`
- Uses **4 start/end variants** and assigns one randomly per wrapper

## Variant Control

- Random by default: every `.blog_image_wrapper` gets one of 4 variants
- Fixed variant (optional): set `data-stroke-variant="1"` (or `2`, `3`, `4`) on a wrapper

Current variant routes:

- `1`: top -> right -> bottom
- `2`: left -> top -> right
- `3`: bottom -> left -> top
- `4`: right -> bottom -> left

Example:

```html
<div class="blog_image_wrapper is-4px" data-stroke-variant="3">
  ...
</div>
```

## How To Use In Webflow

1. Add class `blog_image_wrapper` to the target wrapper.
2. Optionally add combo class `is-3px`, `is-4px`, etc.
3. Paste `partial-stroke.css` into Project/Page Custom Code in `<head>`.
4. Paste `partial-stroke.js` before `</body>`.

## Optional Per-Element Tuning

Use custom properties on any wrapper variant:

```css
.blog_image_wrapper.my-variant {
  --stroke-size: 4px;
  --stroke-color: #22e5d2;
  --stroke-radius: 32px;
  --stroke-start: 0.82;
  --stroke-end: 0.44;
}
```

## Notes

- Keep wrapper `overflow: visible` to show outer half of centered stroke.
- If your wrapper has rounded corners, set `--stroke-radius` to match.
