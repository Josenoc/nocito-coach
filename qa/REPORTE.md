# QA landing + app privada — Informe

**Fecha:** 21/10/2026  
**Rama:** `qa-landing-fixes` (basada en `main` `ca54336`)  
**Alcance:** landing pública, registro/login y app del alumno. Validado en rama antes del merge.  
**Navegador:** Chrome real (Playwright Core, `channel: "chrome"`), desktop 1280×800 y móvil 375×812.

## Resultado general

- `npm run build` pasa y genera `/privacidad` y `/terminos` como páginas estáticas.
- Smoke de producción en `:3311`: `/`, `/privacidad`, `/terminos` y `/app` responden 200.
- Los 6 recorridos del QA corren de punta a punta, incluido login real con `alumnotest` / `0000`.
- No se creó ninguna cuenta real: el registro se probó hasta el paso 5 y el envío final se evitó.
- No se completó un checkout real de Mercado Pago: el entorno local no tiene `MP_ACCESS_TOKEN`. Se verificó el camino de error y que la UI no muestre detalles técnicos.

## Hallazgos y estado

| Prioridad | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| P1 | El header se apiñaba a 1280 px con el nuevo link “Casos de éxito”: palabras en dos líneas y logo superpuesto. | Corregido: links sin wrap, espaciado compacto y escasez oculta hasta 1400 px. | `despues/01-impaciente-hero.png` |
| P1 | Dos títulos “CREÁ TU ACCESO” superpuestos en registro. | Corregido: el wizard es el único que renderiza el título. | `despues/16-nonativo-paso2.png` |
| P1 | Rut&Nut decía `$50`, usaba “Elegir Plan y Registrarme” y abría Mercado Pago. | Corregido: precio visible `TODO-JOSE`, aclaración “Rutina + plan de alimentación” y botón a WhatsApp. | `despues/05-esceptico-planes.png` |
| P1 | El flujo de pago era inconsistente (registro + pago + comprobante mezclados). | Corregido: 4 pasos únicos “Elegís → pagás → enviás comprobante → recibís acceso”; los planes pagos dicen “Elegir plan y pagar”. | `despues/03-impaciente-planes.png` |
| P1 | Error técnico de Mercado Pago visible (`MP_ACCESS_TOKEN`). | Corregido: alerta amigable con alternativa por transferencia/WhatsApp; el detalle queda solo en consola. | `despues/04-impaciente-resultado-pago.png` |
| P1 | No había páginas legales ni aceptación de términos. | Corregido: `/privacidad` y `/terminos` (borradores), links en footer y checkbox obligatorio en el paso 5. | `despues/06-esceptico-privacidad.png`, `despues/07-esceptico-terminos.png`, `despues/10-esceptico-terminos-aceptados.png` |
| P2 | El botón Atrás del navegador perdía el progreso del registro. | Corregido: estado del wizard en `sessionStorage`, historial por paso y PIN no persistido. | `despues/17-nonativo-back-navegador.png` |
| P2 | Labels del registro sin asociación (`getByLabel("Nombre completo")` daba 0). | Corregido: `htmlFor`/`id` en los campos principales; el test ahora devuelve 1. | `despues/15-nonativo-paso1.png` |
| P2 | Un nombre basura de 499 caracteres pasaba la validación. | Corregido: límite 80, solo letras/espacios/apóstrofes/puntos/guiones y rechazo de repeticiones; servidor valida lo mismo. | `despues/18-rompe-junk.png` |
| P2 | Jerga sin explicar: “Web App”, “anamnesis”, “Groq”, “RIR”, “Panel 24/7”. | Corregido en landing y app: “app privada”, “ficha inicial”, “tu panel siempre disponible”, RIR explicado. | `despues/13-movil-app.png` |
| P2 | Sin términos, el registro no mostraba error claro y el servidor no lo exigía. | Corregido: error “Tenés que aceptar…” en cliente y validación 400 en `/api/auth/register`; se guarda `termsAcceptedAt` en la ficha. | `despues/10-esceptico-terminos-aceptados.png` |
| P3 | Imágenes pesadas en JPEG. | Optimizadas a WebP: logo 4 KB, hero 58 KB, fondo gym 90 KB; dimensiones explícitas y lazy loading bajo el fold. | Landing final |

## Verificación antes / después

| Prueba | Antes | Después |
|---|---|---|
| Links legales en footer | 0 | 2 (`/privacidad`, `/terminos`) |
| Estado de páginas legales | 404 | 200 |
| Checkbox de términos en registro | 0 | 1, obligatorio |
| Labels asociados (Nombre completo) | 0 | 1 |
| Atrás del navegador desde el paso 2 | Salía del wizard | Queda en `/app`, paso 1, nombre conservado |
| Nombre basura | 499 caracteres aceptados | Truncado a 80 y rechazado por caracteres inválidos |
| Primer plan de la grilla | Rut&Nut `$50`, botón MP | Rut&Nut `TODO-JOSE`, botón WhatsApp |
| Error de pago | Texto técnico de `MP_ACCESS_TOKEN` | Mensaje amigable, sin detalle técnico |
| Overflow horizontal móvil 375 px | No | No |
| CTA del hero móvil | — | 345×54 px |
| Login `alumnotest` / `0000` | OK | OK |

## Pendientes que requieren decisión de José (`TODO-JOSE`)

1. **Precio real de Rut&Nut**: hoy se muestra `$TODO-JOSE ARS` y el botón deriva a WhatsApp. El cobro online queda bloqueado a propósito (`price: 0`).
2. **Alias/CBU** para transferencias y, si corresponde, link fijo de Mercado Pago.
3. **Plazas reales del mes**: hoy `PLAZAS_DISPONIBLES = 3` en `public/index.html`; con `0` muestra “Lista de espera”.
4. **Datos legales**: razón social, CUIT, domicilio y jurisdicción en `/privacidad` y `/terminos`.
5. **Revisión legal** de ambos documentos y fecha de publicación. Están marcados como BORRADOR y con `noindex`.
6. **Proveedores, analítica y cookies** definitivos para completar la política de privacidad.
7. **Aprobación de copy**: subtítulo del hero (“Si te cuesta sostener el hábito…”), “Rut&Nut = rutina + plan de alimentación” y el flujo de 4 pasos.
8. **`MP_ACCESS_TOKEN` de producción** para probar un checkout real antes de habilitar el cobro.

## Limitaciones de esta prueba

- El checkout real de Mercado Pago no se puede completar localmente sin token; se validó la iniciación, el error amigable y el bloqueo de Rut&Nut.
- No se envió un registro real contra Supabase para no crear datos en producción. Sí se validó el rechazo 400 sin términos aceptados y el build del endpoint.
- Las páginas legales son borradores funcionales, no asesoramiento legal.
- Las capturas “antes” y “después” están en `qa/antes/` y `qa/despues/`; el detalle estructurado está en `observaciones.json`.

## Cómo reproducir

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" run dev -- -p 3400
node qa/run-journeys.js despues
```

El script no crea cuentas: corta el registro antes del envío final y usa el login de prueba existente.
