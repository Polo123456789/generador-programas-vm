# AGENTS.md - Generador Programas VM

## Project

This is a Nuxt 4 application using Vue 3, TypeScript, Tailwind CSS 4, and Bun.

- Package manager: Bun
- Deployment target: GitHub Pages
- Published directory: `docs/`
- GitHub Pages base URL: `/generador-programas-vm/`
- Deployment branch: `master`

## Development Commands

```bash
bun install --frozen-lockfile
bun run dev
bun run build
bun run preview
```

## Required Validation

Run all checks before generating or deploying:

```bash
bunx eslint .
bunx nuxi typecheck
bun run build
```

## GitHub Pages Build

Generate the static application with:

```bash
bun run generate
```

This command runs `nuxt generate` and synchronizes `.output/public/` into
`docs/`. Commit the resulting changes in `docs/`, including renamed or deleted
hashed assets.

After generation:

```bash
git diff --check
git status --short
```

Verify that:

- `docs/index.html` references existing assets under `docs/_nuxt/`.
- The generated app uses the `/generador-programas-vm/` base URL.
- Old hashed assets removed by generation are included in the commit.
- Temporary files such as `*.tsbuildinfo`, `.output/`, and caches are not
  committed.

## Deployment

GitHub Pages is deployed from the committed `docs/` directory on `master`.

Use this sequence:

```bash
bunx eslint .
bunx nuxi typecheck
bun run generate
git diff --check
git add app docs
git commit -m "<descriptive message>"
git push origin master
```

Before committing, inspect the staged changes with:

```bash
git status --short
git diff --cached --check
git diff --cached --stat
```

Only include files related to the requested change and its generated deployment
artifacts. Never discard unrelated user changes.

## TypeScript and Vue

- Use strict TypeScript and explicit return types for public functions.
- Prefer interfaces for shared object shapes.
- Use Vue Composition API with `<script setup lang="ts">`.
- Put reusable stateful logic in `app/composables/`.
- Use named exports for utilities and composables.
- Use the `~/` alias for application imports.
- Guard browser-only APIs with `import.meta.client` or `process.client`.

## Editing Rules

- Preserve existing naming, structure, and implementation patterns.
- Keep changes narrowly scoped to the request.
- Do not manually edit generated files in `docs/`; regenerate them.
- Do not revert or overwrite unrelated working-tree changes.
