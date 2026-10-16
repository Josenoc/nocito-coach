# Guía de Estilo — nocito.coach

> Tokens, tipografías y componentes unificados de la **landing** (`public/index.html`) y la **Web App** (`/app`, `app/globals.css`).

---

## 1. Identidad de marca

- **Nombre:** nocito.coach
- **Estética:** dark mode, alto contraste, acento dorado/ámbar, títulos en mayúsculas, bordes rectos.
- **Valores:** Fuerza · Nutrición · Constancia.

---

## 2. Fuentes

- **Títulos (H1–H4):** `Montserrat` (600, 700, 800) — `text-transform: uppercase`, `letter-spacing: -0.02em`, `line-height: 1.15`.
- **Cuerpo / UI:** `Inter` (400, 500, 600, 700).
- **Fallback:** `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- **Carga (Google Fonts):**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
```

---

## 3. Colores

### 3.1 Acento de marca (dorado)

| Token | Hex | Uso |
|---|---|---|
| `--gold` | `#FFC400` | Acento principal / CTA |
| `--gold-bright` | `#FFD94A` | Estado hover / brillo |
| `--sand` | `#FFE07A` | Degradados / logo |

### 3.2 Superficies y texto

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0A0A0A` | Fondo base |
| `--bg-2` | `#121212` | Fondo secundario (app) |
| `--surface` | `#121212` (app) · `#101010` (landing) | Tarjetas / paneles |
| `--surface-2` | `#1A1A1A` (app) · `#161616` (landing) | Superficies elevadas |
| `--border` | `#242424` | Bordes por defecto |
| `--border-strong` | `#3A3A3A` | Bordes de inputs |
| `--text` | `#EDEDED` | Texto principal |
| `--muted` | `#A6A6A6` (app) · `#8F8F8F` (landing) | Texto secundario |

### 3.3 Estados

| Token | Hex | Uso |
|---|---|---|
| `--ok` | `#34D399` | Éxito / guardado |
| `--danger` | `#FF5252` | Error / eliminar |
| Aviso (pendiente) | `#FFC400` sobre `rgba(255,196,0,.07)` | Estado "en revisión" |

### 3.4 Alias de compatibilidad (legacy)

```css
--orange: var(--gold);        /* histórico: #FF5722 */
--orange-soft: var(--gold-bright);
--blue: var(--gold-bright);   /* histórico: #00E5FF */
```

---

## 4. Escala tipográfica

| Rol | Landing | App `/app` |
|---|---|---|
| H1 hero | `clamp(2.6rem, 6.8vw, 5.4rem)` | `1.6rem` |
| Título de sección | `clamp(2.3rem, 5vw, 4rem)` | — |
| Precio | `clamp(2rem, 4.6vw, 2.7rem)` | — |
| Nombre de ejercicio | — | `1.22rem` |
| Logotipo (texto) | `1.5rem` | `1.28rem` |
| Cuerpo | `1rem` / `line-height 1.6` | `1rem` / `line-height 1.55` |
| Subtítulo | `1.05rem` | `.95rem` |
| Label / etiqueta | `.72rem` — uppercase, `ls .28em` | `.85rem` — uppercase, `ls .09em` |
| Badge | `.68rem` — uppercase, `ls .18em` | `.8rem` — uppercase, `ls .08em` |
| Input numérico | `.98rem` | `1.05rem` |
| Nota / micro-texto | `.86rem` | `.82–.9rem` |

**Regla de títulos:** `Montserrat` + `uppercase` + `letter-spacing: -0.02em` + `line-height: 1.15`.

---

## 5. Espaciado, radios y layout

- **Radios:** app `--radius: 8px`; landing `8px` (nav/botones `6px`, cards `10–18px`); píldoras `999px`.
- **Padding de sección:** landing `.section { padding: 120px 0 }` · app `.section { padding: 28px 16px 72px }`.
- **Contenedor:** landing `min(1200px, 92%)`; app `max-width: 1120px`.
- **Grid de ejercicio:** `minmax(0, 360px) minmax(0, 1fr)` (imagen izq. / series der.).
- **Gaps:** grillas `12px`; tarjetas `18–22px`.

---

## 6. Sombras y glows

```css
/* Glow dorado suave */     0 8px 24px rgba(255,196,0,.28)
/* Glow medio */            0 0 34px 3px rgba(255,196,0,.45)
/* Ring de foco */          0 0 0 3px rgba(255,196,0,.14)
/* Éxito (input) */         0 0 0 3px rgba(52,211,153,.28)
/* Profundidad neutra */    0 30px 70px rgba(0,0,0,.5)
```

- **Tarjeta destacada (Plan Pro):** borde `2px solid #FFC400` + glow pulsante (`@keyframes proGlow`, 2.8s).
- **Tarjeta de ejercicio:** borde `3px solid rgba(255,196,0,.4)` + sombra sutil.

---

## 6.1 Degradados y efectos

```css
/* Texto degradado */   linear-gradient(90deg, #fff, #FFC400 40%, #fff)
/* Marca dorada */      linear-gradient(90deg, #FFC400, #FFE07A)
/* Botón primario */    linear-gradient(180deg, #FFD94A, #FFC400)
/* Card */              linear-gradient(180deg, var(--surface), var(--bg-2))
/* Fondo body (app) */  radial-gradient(900px 520px at 86% -12%, rgba(255,196,0,.10), transparent 60%),
                        radial-gradient(760px 520px at 8% -4%, rgba(255,217,74,.06), transparent 55%),
                        #0A0A0A
```

---

## 7. Componentes

### Botones

**App `.btn`** — `padding: 11px 18px; border-radius: 8px; font-weight: 600; font-size: .95rem`
- `.btn-primary`: gradiente dorado, texto `#0A0A0A`.
- `.btn-outline`: borde `#242424`, fondo `#121212`, hover dorado.
- `.btn-danger`: borde/texto `#FF5252`.

**Landing `.btn`** — `border-radius: 6px; font-size: .8rem; uppercase; letter-spacing: .16em; font-weight: 700; padding: 17px 30px`
- `.btn-primary`: fondo `#FFC400`, texto `#0A0A0A`.

### Inputs
- `.input` / `.field`: fondo `#121212`, borde `#242424`, radius `8px`; focus borde dorado + ring.
- `.num-input` (uso en gym): fondo `#27272A`, borde `#3A3A3A`, texto centrado, `1.05rem`, `600`.
- Ghost / objetivo de referencia: dorado con `opacity: .6`.

### Cards
- `.card`: gradiente de superficie, borde `#242424`, radius `8px`, padding `20px`.
- `.exercise-card`: borde dorado `3px` al 40% + glow.
- `.price-card.featured`: fondo `#1A1508 → #120F05`, borde dorado 2px, glow pulsante, badge **"Más Elegido"**.

### Badges y píldoras
- `.badge`: uppercase `.8rem`, borde dorado al 40%, texto dorado, radius `999px`.
- `.chip`: píldora; activo = gradiente dorado, texto `#0A0A0A`.
- `.pill.pending` (dorado) · `.pill.active` (gris).

### Estados / avisos
- `.toast.ok`: fondo `rgba(52,211,153,.12)`, borde `#34D399`.
- `.toast.err`: fondo `rgba(255,82,82,.12)`, borde `#FF5252`.
- `.notice-review`: borde dorado al 40%, marca circular con glow (estado "en revisión").

### Micro-interacciones
- `rowFlash` (fila guardada): fondo `rgba(52,211,153,.22)` → transparente (0.9s).
- `inputFlash`: borde/sombra verde de éxito (0.9s).
- `flagPop`: check verde con rebote (0.9s).

---

## 8. Breakpoints

`560px` (1 columna precios) · `640px` (móvil app) · `900px` (grillas a 1 columna) · `960px` (hero-rail) · `1080px` (precios a 2 columnas).

---

## 9. Tokens listos para pegar (CSS)

```css
:root {
  color-scheme: dark;

  /* Marca */
  --gold: #FFC400;
  --gold-bright: #FFD94A;
  --sand: #FFE07A;

  /* Superficies */
  --bg: #0A0A0A;
  --bg-2: #121212;
  --surface: #121212;
  --surface-2: #1A1A1A;
  --border: #242424;

  /* Texto */
  --text: #EDEDED;
  --muted: #A6A6A6;

  /* Estados */
  --ok: #34D399;
  --danger: #FF5252;

  /* Radios */
  --radius: 8px;

  /* Alias de compatibilidad */
  --orange: var(--gold);
  --orange-soft: var(--gold-bright);
  --blue: var(--gold-bright);
}
```
