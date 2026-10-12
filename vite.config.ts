import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // `npm run dev:lan` serves over HTTPS on your local network so you can test on
  // an iPhone/iPad. HTTPS matters: browsers only expose gamepads to secure origins.
  const lan = mode === 'lan';
  return {
    // Relative asset paths so the build works from any sub-path (GitHub Pages, itch.io, etc).
    base: './',
    plugins: lan ? [basicSsl()] : [],
    server: lan ? { host: true } : {},
    build: {
      // Down-level syntax for older Apple devices (iOS/iPadOS/macOS Safari 14+).
      target: ['es2020', 'safari14', 'ios14', 'chrome90', 'firefox90', 'edge90'],
    },
  };
});
