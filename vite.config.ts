import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    // Keep generated asset URLs relative to index.html. This lets the same build run
    // both at a custom-domain root and under GitHub Pages' /taktcontrol/ path.
    base: './',
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: 'TaktControl — rhythm practice',
                short_name: 'TaktControl',
                description: 'A rhythm trainer for guitarists.',
                theme_color: '#101717',
                background_color: '#101717',
                display: 'standalone',
                icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
        }),
    ],
})
