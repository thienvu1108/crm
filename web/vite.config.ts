import adapter from '@sveltejs/adapter-static';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		withPwa(
			{
				compilerOptions: {
					runes: ({ filename }: { filename: string }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter({
					pages: 'build',
					assets: 'build',
					fallback: 'index.html',
					precompress: false,
					strict: false
				})
			},
			{
				strategy: 'generateSW',
				registerType: 'autoUpdate',
				manifest: {
					name: 'Mayhomes CRM',
					short_name: 'Mayhomes',
					description: 'CRM sale bất động sản — mobile-first',
					lang: 'vi',
					theme_color: '#0f3d2e',
					background_color: '#f6f3ee',
					display: 'standalone',
					start_url: '/',
					icons: [
						{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
					]
				},
				generateSW: {
					navigateFallback: '/',
					globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}']
				}
			}
		)
	],
	server: {
		proxy: {
			'/api': 'http://127.0.0.1:3000',
			'/auth': 'http://127.0.0.1:3000'
		}
	}
});
