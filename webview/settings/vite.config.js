import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [vue()],
    base: '',
    root: resolve(__dirname),
    build: {
        outDir: resolve(__dirname, '..', '..', 'res', 'html', 'settings'),
        emptyOutDir: true,
        cssCodeSplit: false,
        rollupOptions: {
            input: resolve(__dirname, 'index.html'),
            output: {
                entryFileNames: 'js/app.js',
                chunkFileNames: 'js/chunk-vendors.js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.css')) return 'css/app.css'
                    return 'assets/[name][extname]'
                }
            }
        }
    }
})
