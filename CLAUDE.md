## Project context

Personal site for 林郁為 (stats background moving into data science). **Not shared publicly yet** — stays unlisted until `/projects` has real content, then goes into the resume.

Deliberate decisions — don't "fix" these without asking first:
- The two categories (`stats` 統計分析, `ai` AI實作) are intentionally empty right now. Do **not** add "under construction" text or placeholder/sample projects to fill the gap.
- The homepage entry links intentionally omit LinkedIn and the resume PDF (neither exists yet). Add them the same way once the user provides them — no placeholder link in the meantime.
- `public/robots.txt` intentionally blocks all crawlers (`Disallow: /`) until the site is ready to go into the resume — remove it then, not before.

How to add a project (no route/nav changes needed):
- Drop a `.md` file into `src/content/projects/stats/` or `src/content/projects/ai/`. Schema is in `src/content.config.ts` (title, summary, category, tags?, links?, date). The list page and `/projects/{category}/{slug}/` detail page pick it up automatically.

Architecture notes:
- Nested URLs: `/projects/{category}/{slug}/` (category is baked into the URL, not a flat tag).
- i18n is pre-wired for a future English version: `locales: ['zh']`, `defaultLocale: 'zh'`, `routing.prefixDefaultLocale: false` in `astro.config.mjs`. Adding `'en'` later won't change existing `zh` URLs.
- Deploy: GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`, `withastro/action`), auto-deploys on push to `main`. Repo is `xup6m4jo6222.github.io` (GitHub user site, root domain).

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
