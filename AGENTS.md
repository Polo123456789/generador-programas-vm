# AGENTS.md - Coding Guidelines for Generador Programas VM

## Project Overview

This is a **Nuxt.js 4** application with **Vue 3**, **TypeScript**, and **Tailwind CSS v4**. It generates printable weekly meeting programs by scraping data from external sources.

- **Package Manager**: Bun (bun.lock present)
- **Framework**: Nuxt 4.1.3 with Vue 3.5
- **Styling**: Tailwind CSS 4.1.14 via Vite plugin
- **Linting**: ESLint 9 via @nuxt/eslint

## Build/Lint Commands

```bash
# Development server (http://localhost:3000)
bun run dev

# Build for production
bun run build

# Generate static site (outputs to docs/ folder via rsync)
bun run generate

# Preview production build
bun run preview

# Run ESLint
bunx eslint .

# Post-install hook (prepare Nuxt)
bun run postinstall
```

### Test Commands

**No test framework is currently configured.** If adding tests, recommended setup:
- Use Vitest for unit tests (integrated with Nuxt)
- Use @nuxt/test-utils for component/integration tests
- Place tests alongside source files as `*.test.ts` or `*.spec.ts`

## Code Style Guidelines

### TypeScript

- Use **strict TypeScript** with explicit types
- Prefer `interface` over `type` for object shapes
- Export interfaces that are used across modules
- Use explicit return types on public functions

```typescript
// Good
export interface Assignment {
  title: string
  duration: number
  student: string
  assistant?: string  // Optional fields last
}

export async function fetchAssignments(url: string): Promise<Assignment[]> {
  // Implementation
}
```

### Vue Components

- Use **Composition API** with `<script setup lang="ts">`
- Use `defineModel<T>()` for v-model bindings
- Scoped styles with `<style scoped>`
- Component names in PascalCase (e.g., `PrintableInput.vue`)

```vue
<script setup lang="ts">
const text = defineModel<string>();
</script>

<template>
  <input type="text" v-model="text" />
</template>

<style scoped>
input {
  border: 1px solid #d1d5db;
}
</style>
```

### Imports & Exports

- Use named exports for utilities and composables
- Import Vue functions explicitly: `import { ref, watch } from 'vue'`
- Group imports: external libs → internal modules → types
- Use `~/` alias for app directory imports

```typescript
// Order: external → internal → types
import * as cheerio from 'cheerio'
import { ref, watch } from 'vue'
import { useLocalStorage } from '~/composables/useLocalStorage'
import type { Assignment } from '~/utils/assignments'
```

### Naming Conventions

- **Components**: PascalCase (e.g., `PrintableInput.vue`)
- **Composables**: camelCase prefixed with `use` (e.g., `useLocalStorage.ts`)
- **Utils**: camelCase (e.g., `assignments.ts`)
- **Variables**: camelCase
- **Types/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE for true constants

### Composables Pattern

Always place reusable stateful logic in `app/composables/`:

```typescript
// app/composables/useLocalStorage.ts
import { ref, watch } from 'vue'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const storedValue = ref<T>(initialValue)
  
  if (process.client) {
    // Client-side only logic
    const item = window.localStorage.getItem(key)
    // ... implementation
  }
  
  return storedValue
}
```

### Error Handling

- Always check fetch responses with `res.ok`
- Throw descriptive errors with context
- Use try-catch for JSON parsing
- Handle optional chaining safely

```typescript
if (!res.ok) {
  throw new Error(`Failed to fetch ${url}: ${res.statusText}`)
}

try {
  storedValue.value = JSON.parse(item)
} catch (e) {
  console.error(`Error parsing localStorage key "${key}"`, e)
}
```

### Styling (Tailwind CSS)

- Use Tailwind utility classes in templates
- Custom CSS in `<style scoped>` for print media queries
- Use `process.client` guards for browser APIs

```css
@media print {
  .dont-print {
    display: none;
  }
  
  .dont-break {
    page-break-inside: avoid;
  }
}
```

### Project Structure

```
app/
├── app.vue              # Root component
├── components/          # Vue components (auto-imported)
│   ├── Button.vue
│   ├── PrintableInput.vue
│   └── PrintHeader.vue
├── composables/         # Reusable composition functions (auto-imported)
│   └── useLocalStorage.ts
├── utils/               # Utility functions (auto-imported)
│   └── assignments.ts
└── assets/
    └── css/
        └── main.css     # Global styles + Tailwind import
```

### Key Conventions

1. **Auto-imports**: Nuxt auto-imports components, composables, and utils
2. **TypeScript**: Strict mode enabled via Nuxt config
3. **Client-only code**: Wrap browser APIs with `if (process.client)`
4. **Base URL**: App deployed to `/generador-programas-vm/` (configured in nuxt.config.ts)
5. **Local storage**: Use the `useLocalStorage` composable for persistence
