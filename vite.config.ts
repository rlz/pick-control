import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    // Keep generated asset URLs relative to index.html. This lets the same build run
    // both at a custom-domain root and under GitHub Pages' /pick-control/ path.
    base: './',
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: false,
            includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'],
        }),
    ],
})
