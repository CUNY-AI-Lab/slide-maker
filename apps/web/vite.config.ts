import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	envPrefix: ['VITE_', 'PUBLIC_'],
	server: {
		host: '127.0.0.1',
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				configure: (proxy) => {
					// Ensure Origin header is present so Hono CSRF middleware accepts proxied requests.
					// Browsers may omit Origin on same-origin fetches, but the API expects it.
					proxy.on('proxyReq', (proxyReq) => {
						if (!proxyReq.getHeader('origin')) {
							proxyReq.setHeader('origin', 'http://localhost:5173')
						}
					})
				},
			},
		},
	},
	preview: {
		host: '127.0.0.1',
		allowedHosts: ['tools.cuny.qzz.io'],
	},
});
