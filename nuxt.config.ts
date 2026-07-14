import tailwindcss from '@tailwindcss/vite'
import { createBuildId } from './scripts/buildId'

export default defineNuxtConfig({
  buildId: createBuildId(),
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    baseURL: '/generador-programas-vm/',
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Generador de Programas VM',
      meta: [
        {
          name: 'description',
          content: 'Prepara, asigna y guarda el programa de la reunión de entre semana.',
        },
      ],
      link: [
        { rel: 'icon', href: '/generador-programas-vm/favicon.ico' },
      ],
    },
  },
})
