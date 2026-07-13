import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: { entry: resolve(__dirname, 'src/main/index.ts') }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: { entry: resolve(__dirname, 'src/preload/index.ts') }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          panel: resolve(__dirname, 'src/renderer/panel/index.html'),
          splash: resolve(__dirname, 'src/renderer/splash/index.html'),
          worker: resolve(__dirname, 'src/renderer/worker/index.html')
        }
      }
    }
  }
})
