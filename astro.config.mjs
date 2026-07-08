// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://xup6m4jo6222.github.io',
	i18n: {
		locales: ['zh'],
		defaultLocale: 'zh',
		routing: {
			prefixDefaultLocale: false,
		},
	},
});
