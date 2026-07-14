# Generador de Programas VM

Aplicación web para preparar el programa de la reunión de entre semana de una
congregación. Importa la estructura de varias semanas desde una publicación,
permite asignar participantes y conserva el borrador en el navegador.

La aplicación es una SPA estática: no tiene servidor propio ni cuentas de
usuario. Se publica con GitHub Pages desde [`docs/`](./docs/) y usa la ruta base
`/generador-programas-vm/`.

> [!IMPORTANT]
> La vista impresa replica deliberadamente el formato del programa físico. Los
> cambios de interfaz deben mejorar la experiencia en pantalla sin alterar esa
> composición, su orden ni sus saltos de impresión.

## Funcionalidad

- Importa semanas y partes desde una URL compatible.
- Permite completar o editar manualmente todas las asignaciones.
- Administra estudiantes activos y ocultos.
- Sugiere estudiantes y compañeros a partir del historial de asignaciones.
- Guarda automáticamente el programa y los datos auxiliares en el navegador.
- Imprime el programa con un formato compacto y estable.

## Arquitectura

El proyecto usa Nuxt 4, Vue 3, TypeScript estricto, Tailwind CSS 4 y Bun.
`ssr: false` mantiene la aplicación completamente del lado del cliente, algo
necesario para el almacenamiento local y compatible con GitHub Pages.

| Ruta | Responsabilidad |
| --- | --- |
| `app/pages/index.vue` | Importación, edición y composición imprimible del programa. |
| `app/pages/students.vue` | Administración de estudiantes e historial visible. |
| `app/components/` | Controles reutilizables de edición y asignación. |
| `app/composables/` | Estado reactivo, persistencia, migraciones y reglas de asignación. |
| `app/types/` | Modelos compartidos del programa, estudiantes e historial. |
| `app/utils/` | Validación, migración, recomendaciones y adaptación de datos externos. |
| `scripts/` | Identificador de build, normalización y validación reproducible de `docs/`. |
| `tests/` | Pruebas unitarias que protegen los contratos locales. |
| `docs/` | Salida generada para GitHub Pages; nunca se edita a mano. |

Las páginas consumen el estado mediante composables. La persistencia es
responsabilidad de una sola capa y no del ciclo de vida de una página o un
componente. Esto permite navegar entre pantallas sin detener el guardado y
mantiene las actualizaciones del programa y del historial consistentes.

## Datos locales, migración y respaldo

El programa, los estudiantes, el historial y la última URL se almacenan como un
snapshot con `schemaVersion: 1`, revisión y fecha de guardado en la clave
`generador-programas-vm:state` de `localStorage`. El snapshot anterior válido
se conserva en `generador-programas-vm:state:backup`. Los datos pertenecen al
origen de la aplicación: no se sincronizan con otros dispositivos y se pierden
si se borran los datos del sitio en el navegador.

La capa de persistencia trata el contenido almacenado como entrada no
confiable: valida su estructura antes de exponerlo a la interfaz. El formato
actual incluye una versión de esquema para poder migrar datos antiguos sin
romper el inicio de la aplicación. La primera carga también reconoce las claves
heredadas `lastAssingmentsURL`, `assingments`, `students` y
`assignmentHistory`; `assingments:backup` puede servir como último recurso si
el programa legado principal está dañado. Estas claves solo existen por
compatibilidad y no deben usarse para funcionalidad nueva.

La revisión permite detectar si otra pestaña guardó una versión más reciente. En
ese caso la aplicación no sobrescribe datos silenciosamente: pide elegir entre
los cambios locales y los de la otra pestaña.

Antes de cada escritura se valida el snapshot nuevo. La capa escribe el nuevo
principal y solo entonces promueve el principal anterior a backup; si ese
segundo paso falla, revierte el principal para no perder el respaldo que ya
existía. Al iniciar se intenta cargar, en
orden, el snapshot principal, el backup, los datos heredados y finalmente un
estado vacío seguro. Nunca se interpreta un JSON válido pero incompatible como
estado de la aplicación. Un fallo de cuota o de acceso a `localStorage` se
presenta al usuario y no debe cerrar la interfaz.

La exportación descarga el snapshot completo. La importación valida todo el
archivo y fuerza primero el guardado del borrador visible; si eso falla, cancela
la sustitución. Después de importar, el snapshot anterior queda como respaldo.
Si falla esa segunda escritura, la versión importada permanece disponible en
memoria y el borrador anterior sigue intacto en almacenamiento. Un archivo
inválido no cambia el borrador. La interfaz también permite restaurar el
respaldo anterior y deshacer el último refresco o borrado del programa durante
la sesión. Aplicar un respaldo completo invalida ese “deshacer” para no mezclar
estudiantes e historial de dos estados.

Estas garantías no convierten el almacenamiento del navegador en un respaldo
externo. Antes de limpiar el navegador o cambiar de dominio conviene exportar
una copia desde la aplicación y comprobar que el archivo puede importarse.

## Importación y dependencia del proxy

El navegador no puede leer directamente algunos sitios remotos por sus reglas
CORS, por lo que la importación usa `https://corsproxy.io/`. Tanto ese servicio
público como el HTML de origen están fuera del control de este proyecto. Un
cambio de disponibilidad, selectores, idioma o estructura puede romper la
importación aunque la aplicación no haya cambiado.

Esta fragilidad es una limitación aceptada. El importador comprueba que el
resultado tenga semanas utilizables antes de reemplazar el borrador, muestra un
error accionable y conserva el trabajo existente ante respuestas vacías o
inválidas. No se busca replicar ni estabilizar por completo la fuente externa.
Si el proxy falla, se puede seguir trabajando con el borrador local y editarlo
manualmente.

La URL solicitada y el contenido público importado pasan por el proxy. Los
nombres de estudiantes y las asignaciones locales no se envían al proxy.

## Desarrollo

Requisitos:

- [Bun](https://bun.sh/) 1.3.14.
- `rsync` para sincronizar la generación estática con `docs/`.

Instala exactamente las versiones registradas en el lockfile y arranca el
servidor:

```bash
bun install --frozen-lockfile
bun run dev
```

Debido a la ruta base de Pages, la aplicación local se sirve bajo
`http://localhost:3000/generador-programas-vm/`.

Comandos disponibles:

| Comando | Uso |
| --- | --- |
| `bun run dev` | Servidor de desarrollo con recarga en caliente. |
| `bun run lint` | ESLint sobre fuentes mantenidas; omite generados y caches. |
| `bun run typecheck` | Comprobación de tipos de Nuxt y Vue. |
| `bun run test` | Pruebas con el runner integrado de Bun. |
| `bun run build` | Build de producción. |
| `bun run check` | Ejecuta lint, tipos, pruebas y build, en ese orden. |
| `bun run generate` | Genera la SPA y sincroniza `.output/public/` con `docs/`. |
| `bun run verify:generated` | Comprueba `.nojekyll`, ruta base y assets referenciados. |
| `bun run preview` | Sirve `docs/` localmente bajo la misma ruta base de Pages. |

## Validación

Antes de integrar un cambio ejecuta:

```bash
bun run check
```

Los cambios de persistencia deben cubrir como mínimo datos válidos, datos
corruptos, migración desde claves heredadas, recuperación del respaldo y fallo
de escritura. Los cambios en recomendaciones deben probar reasignaciones y
semanas que crucen de un año a otro. Las pruebas locales no dependen de la
disponibilidad real del proxy; el importador únicamente garantiza que una
respuesta vacía o inválida no reemplaza el trabajo existente.

La composición impresa se comprueba además con un programa representativo de
varias semanas: se genera un PDF Letter y se compara visualmente con la versión
anterior. Este smoke cubre orden, colores, saltos de página y tabla de resumen;
las mejoras exclusivas de pantalla usan `dont-print` o `@media screen`.

La integración continua ejecuta el mismo gate, regenera el sitio, valida sus
assets y falla si `docs/` contiene diferencias, eliminaciones o archivos nuevos
sin commit. Esto detecta un bundle desactualizado; impedir un despliegue desde
`master` también requiere la protección de rama correspondiente en GitHub.

## Generación y despliegue

GitHub Pages publica el directorio `docs/` de la rama `master`. Para preparar
un despliegue:

```bash
bun run check
bun run generate
git diff --check
git status --short
```

Revisa que `docs/index.html` use `/generador-programas-vm/`, que todos sus
assets bajo `docs/_nuxt/` existan y que los hashes antiguos eliminados formen
parte del commit. La generación usa un build ID derivado de las fuentes y
normaliza metadatos temporales, por lo que dos generaciones limpias del mismo
commit deben producir exactamente el mismo árbol. Después inspecciona
únicamente los cambios relacionados:

```bash
git add app tests docs scripts public .github README.md package.json bun.lock \
  eslint.config.mjs nuxt.config.ts tsconfig.json .gitignore
git diff --cached --check
git diff --cached --stat
git commit -m "descripción del cambio"
git push origin master
```

En el commit inicial de esta modernización, añade también la eliminación del
archivo legado con `git add -u -- format.html`; no forma parte de despliegues
posteriores porque el archivo ya no existirá.

No se deben versionar `.output/`, `.nuxt/`, `*.tsbuildinfo`, dependencias ni
caches. Tampoco se deben corregir archivos dentro de `docs/` manualmente: si la
salida es incorrecta, se corrige la fuente y se vuelve a ejecutar
`bun run generate`.
