import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	envPrefix: ['VITE_', 'PUBLIC_'],
	preview: {
		allowedHosts: ['tools.cuny.qzz.io'],
	},
});
