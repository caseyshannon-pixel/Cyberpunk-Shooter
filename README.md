# NEON//GRID

A cyberpunk top-down twin-stick shooter built with Vite + TypeScript + HTML5 Canvas (no engine).

> Work in progress. Phase 1 (movement, aiming, shooting, dash; gamepad, keyboard/mouse and touch) is in place.
> A full README (controls, adding weapons/enemies) lands with the final phase.

```bash
npm install
npm run dev       # http://localhost:5173
npm run dev:lan   # HTTPS on your local network, for testing on phones/tablets
npm run build     # type-check + production build into dist/
```

## Apple devices (iPhone, iPad, Mac)

Runs in Safari 14+ on iOS, iPadOS and macOS (and any modern Chromium/Firefox).

- **Touch controls** appear automatically on phones/tablets: drag on the left half to move,
  drag on the right half to aim and auto-fire, plus DASH / SWAP / pause buttons.
  Menus are tap-to-select. Play in landscape — portrait shows a rotate prompt and pauses.
- **Controllers** (Xbox, PlayStation DualShock/DualSense, MFi) work in Safari via the Gamepad API.
  Press a button on the controller once after the page loads so Safari exposes it.
- **iPad trackpad/mouse and keyboard** work like on desktop (mouse aims, WASD moves).
- **Full screen:** on iPhone, use Share → *Add to Home Screen* and launch from the icon —
  it opens full-screen in landscape with no Safari UI. On iPad and Mac, tap the ⛶ button
  (top-left, touch) or press **F**.

### Testing on an iPhone/iPad from your computer

1. Put the device on the same Wi-Fi as your computer.
2. Run `npm run dev:lan` and open the printed `Network: https://…` URL in Safari on the device.
3. Safari warns about the self-signed certificate: tap *Show Details* → *visit this website*.
   (HTTPS is needed because browsers only expose gamepads to secure pages.)

To host it for real, `npm run build` and upload `dist/` to any static host (GitHub Pages,
Netlify, itch.io…). Asset paths are relative, so it works from a sub-folder too.
