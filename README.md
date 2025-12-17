# Seamless Patterns

A seamless tile pattern creator built with React, Fabric.js, and TypeScript. Create repeating patterns with automatic 3x3 mirroring, multi-layer support, and SVG/image import capabilities.

## Features

- **Automatic Tiling**: Draw once, see it tile across a 3x3 grid in real-time
- **Drawing Tools**: Brush, eraser, rectangle, and circle tools
- **Vector Support**: Import and edit SVG files with full vector editing
- **Multi-Layer System**: Organize your work with layers, visibility toggles, and z-ordering
- **Entity Grouping**: Group multiple objects to move/transform them together
- **Export Options**: Export tiles as PNG, JPEG, or SVG at various resolutions
- **Project Save/Load**: Save and restore your work with `.tiles` project files
- **Auto-Save**: Automatic session recovery from browser storage
- **Accessible UI**: Built with React Aria for full keyboard navigation and screen reader support

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build
```

The app runs at `http://localhost:5177`

## Usage

1. **Drawing**: Select a tool from the left sidebar and draw on the canvas
2. **Colors**: Pick a color from presets or enter a hex value
3. **Shapes**: Use rectangle/circle tools - click and drag to create
4. **Import**: Click "Import File" for images or "SVG Code" to paste SVG markup
5. **Layers**: Use the right panel to manage layers and object properties
6. **Export**: Click "Export" for tile images or "Export Project" to save your work

### Keyboard Shortcuts

- `Ctrl/Cmd + G`: Group selected objects
- `Ctrl/Cmd + Shift + G`: Ungroup selected objects
- Arrow keys: Nudge selected object (hold Shift for 10px)
- `Ctrl/Cmd + Enter`: Confirm in dialogs

## Tech Stack

- **React 18** with TypeScript
- **Fabric.js 6** for canvas manipulation
- **React Aria Components** for accessible UI
- **Tailwind CSS v4** for styling
- **Vite** for development and builds
- **CodeMirror 6** for SVG code editing

## Project Structure

```
src/
├── App.tsx                 # Main application component
├── components/
│   ├── Canvas/            # FabricCanvas, GridOverlay, ZoomView
│   ├── Panels/            # LayerPanel, EntityPanel, PlacementPanel, PropertiesPanel
│   ├── *Dialog/           # Modal dialogs for import/export
│   └── CodeEditor/        # CodeMirror wrapper
├── core/                  # Business logic
│   ├── TilingEngine.ts    # Core mirroring and sync
│   ├── LayerManager.ts    # Layer state management
│   └── ...               # Other managers
├── hooks/                 # React hooks
├── types/                 # TypeScript definitions
└── utils/                 # Helpers for import/export
```

## License

MIT
