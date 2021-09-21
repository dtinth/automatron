import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),

    VitePWA({
      manifest: {
        short_name: 'automatron',
        name: 'automatron',
        start_url: '/',
        icons: [
          {
            src: '/automatron.png',
            type: 'image/png',
            sizes: '256x256',
          },
        ],
        display: 'standalone',
        theme_color: '#090807',
        background_color: '#353433',
      },
    }),
  ],
})
