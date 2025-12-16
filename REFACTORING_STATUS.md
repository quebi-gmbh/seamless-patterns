# Refactoring to React Aria + Tailwind CSS - Status

## ✅ Completed

### Phase 1: Infrastructure Setup
- ✅ Installed `react-aria-components` (v1.13.0)
- ✅ Installed `tailwindcss` (v4.1.18)
- ✅ Installed `postcss` (v8.5.6)
- ✅ Installed `autoprefixer` (v10.4.23)
- ✅ Created `tailwind.config.js` with custom color theme
- ✅ Created `postcss.config.js`
- ✅ Updated `src/index.css` with Tailwind directives

### SVG Features Completed (Previous Work)
- ✅ SVG inner content editing (users paste content without `<svg>` wrapper)
- ✅ SVG utilities created
- ✅ Properties panel for shapes (rect, circle, path, image)

## 🚧 In Progress / Remaining Work

This is a **major refactoring** affecting 17 components and 14 CSS files. The infrastructure is now in place, but the component refactoring requires:

### Phase 2: Fix Collapsible Panel
- [ ] Rewrite `CollapsiblePanel.tsx` using React Aria's Disclosure component
- [ ] Add Tailwind styling
- [ ] Add proper ARIA labels
- [ ] Test keyboard navigation

### Phase 3: Refactor Panels (4 components)
- [ ] `EntityPanel.tsx` - Convert to React Aria ListBox + Tailwind
- [ ] `PlacementPanel.tsx` - Convert number inputs to NumberField, toggle to Switch
- [ ] `PropertiesPanel.tsx` - Convert inputs to React Aria components
- [ ] `LayerPanel.tsx` - Convert to React Aria ListBox + Button components

### Phase 4: Refactor Dialogs (6 components)
- [ ] `ImportDialog.tsx`
- [ ] `SVGCodeDialog.tsx`
- [ ] `SVGEditDialog.tsx`
- [ ] `ExportDialog.tsx`
- [ ] `ProjectExportDialog.tsx`
- [ ] `RecoveryDialog.tsx`

All dialogs need:
- React Aria `<Modal>` + `<Dialog>` + `<Heading>`
- Tailwind styling
- Proper ARIA labels
- Focus trap and keyboard handling

### Phase 5: Other Components (7 components)
- [ ] `CodeEditor.tsx` - Add Tailwind wrapper
- [ ] `ZoomView.tsx` - Tailwind layout
- [ ] `App.tsx` - Main layout with Tailwind grid/flex
- [ ] `FabricCanvas.tsx` - Minimal changes
- [ ] `GridOverlay.tsx` - Minimal changes
- [ ] `LayerPanel.tsx` - Full refactor
- [ ] Others as needed

### Phase 6: Cleanup
- [ ] Delete 13 CSS files (keep only index.css)
- [ ] Remove all CSS imports
- [ ] Test all functionality
- [ ] Verify accessibility with screen reader
- [ ] Check keyboard navigation

## Estimated Remaining Effort

- **CollapsiblePanel fix**: 30 minutes
- **Panels refactor**: 2-3 hours (4 components)
- **Dialogs refactor**: 3-4 hours (6 components)
- **Other components**: 2-3 hours
- **Testing & cleanup**: 1-2 hours

**Total**: ~8-12 hours of focused development

## Why This is Complex

1. **React Aria Components** require understanding their API and patterns
2. **Tailwind CSS** conversion requires careful translation of existing styles
3. **Accessibility** requirements need proper ARIA labels and keyboard handling
4. **Testing** each component to ensure nothing breaks
5. **State management** needs to be adapted to React Aria patterns

## Next Steps

The user should decide:
1. **Quick fix**: Just fix the CollapsiblePanel to make it work
2. **Full refactor**: Complete all phases (recommended for production-ready accessible app)
3. **Hybrid**: Fix CollapsiblePanel + refactor panels, leave dialogs for later

## Technical Notes

### React Aria Components Used
- `<Button>` - All interactive buttons
- `<Dialog>`, `<Modal>`, `<Heading>` - Modal dialogs
- `<DisclosurePanel>` - Collapsible panels
- `<ListBox>`, `<ListBoxItem>` - Entity and layer lists
- `<NumberField>` - Numeric inputs
- `<TextField>` - Text inputs
- `<Switch>` - Toggle switches
- `<Slider>` - Range sliders

### Tailwind Patterns
```tsx
// Panel
className="bg-[var(--bg-panel)] backdrop-blur-sm rounded-lg border border-[var(--border-subtle)] p-4"

// Button
className="px-3 py-2 bg-[var(--accent-coral)] hover:bg-[var(--accent-coral)]/90 rounded text-sm font-medium transition-colors"

// Input
className="px-3 py-2 bg-white/5 border border-[var(--border-subtle)] rounded focus:ring-2 focus:ring-[var(--accent-teal)] outline-none"
```

## Current Build Status

The app should still build and run with the Tailwind infrastructure in place, but the collapsible panels may not work correctly until Phase 2 is complete.

To test: `pnpm run dev`
