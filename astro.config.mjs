// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://xup6m4jo6222.github.io',
	/* 語法高亮關掉。預設主題（github-dark）會把 `#24292e`／`#e1e4e8` 兩個色碼以行內樣式
	   寫進產物——那是站外的一套配色，配色閘門當場判紅。站上目前唯一的程式區塊是正式報告
	   裡的模型式子，本來就沒有語法可以高亮。 */
	markdown: {
		syntaxHighlight: false,
	},
	i18n: {
		locales: ['zh'],
		defaultLocale: 'zh',
		routing: {
			prefixDefaultLocale: false,
		},
	},
});
