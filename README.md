# Generador Programas VM

La misma aplicación se puede publicar con servidor o como sitio estático.

## Instalación

```bash
bun install --frozen-lockfile
```

## Con servidor

```bash
bun run dev
```

Para producción:

```bash
bun run build
bun run start
```

La aplicación está en `/generador-programas-vm/`. Las importaciones usan el endpoint
propio `/generador-programas-vm/api/proxy`, que solo permite HTTPS hacia
`wol.jw.org` y `www.jw.org`, incluidos los destinos de redirecciones.
El servidor no requiere habilitar SSR.

## Estático y GitHub Pages

```bash
bun run generate
```

Este comando selecciona el proxy externo `cors.dev` y sincroniza el sitio en
`docs/`, eliminando los assets anteriores. No necesita un servidor de aplicación.
GitHub Pages publica el directorio `docs/` de la rama `master` al hacer push.
No se deben publicar los archivos de `.output/` en Git.

Antes de generar o publicar, ejecutar los controles de `AGENTS.md`:

```bash
bunx eslint .
bunx nuxi typecheck
bun run build
bun run generate
git diff --check
```
