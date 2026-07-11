// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    name: 'project/generated-files',
    ignores: [
      '.nuxt/**',
      '.output/**',
      'coverage/**',
      'docs/**',
      'node_modules/**',
      '*.tsbuildinfo',
    ],
  },
)
