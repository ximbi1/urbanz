# 🏃‍♂️ URBANZ - Territory Run

> Conquista territorios mientras corres. Compite. Domina tu ciudad.

**URBANZ** es una aplicación gamificada de running que transforma cada carrera en una batalla por conquistar territorios urbanos. Combina ejercicio físico, competencia social y estrategia territorial.

---

## 🎯 Concepto

URBANZ fusiona tres elementos:
- **App de running**: Tracking GPS, estadísticas, progreso
- **Juego de conquista territorial**: Crea polígonos corriendo para reclamar zonas
- **Red social competitiva**: Ligas, amigos, desafíos, notificaciones

### ¿Para quién?
- 🏃 **Runners urbanos** que buscan motivación extra
- 🎮 **Gamers casuales** que quieren hacer ejercicio divertido
- 🏆 **Usuarios competitivos** que disfrutan de ligas y logros
- 👥 **Grupos de amigos** que quieren competir entre ellos

---

## ⚡ Características Principales

### 🗺️ Sistema de Territorios
- **Conquista por polígonos**: Corre creando formas cerradas para reclamar territorio
- **Robo estratégico**: Conquista territorios ajenos superando su ritmo promedio
- **Protección temporal**: 24h de inmunidad tras conquistar
- **Cooldown anti-spam**: 6h antes de poder reconquistar el mismo territorio
- **Bonus de defensa**: Los territorios son más difíciles de robar según tu nivel
- **Metadatos persistentes**: Cada territorio guarda `protected_until`, `cooldown_until`, ritmo requerido y el historial de eventos para reconstruir disputas
- **Territorios temáticos**: Detectamos parques y zonas emblemáticas para etiquetar la conquista.
- **Retos en el mapa**: Pines especiales aparecen en MapView; rodea la zona para reclamar puntos extra.

### 🎮 Progresión y Gamificación
- **Sistema de niveles**: Gana XP por distancia, territorios y actividad
- **Logros desbloqueables**: Por distancia, territorios y rachas
- **Desafíos semanales**: Objetivos rotativos con recompensas
- **Puntos y ligas**: Sistema competitivo global y entre amigos

### 👥 Social
- **Sistema de amigos**: Invita, acepta, compite
- **Ligas competitivas**:
  - Global: Top runners del mundo
  - Amigos: Compite solo con tu círculo
- **Feed de actividad**: Ve las carreras y conquistas recientes
- **Notificaciones**: Alertas de logros, desafíos y actividad social

### 🛡️ Protección Anti-Exploit
- **Filtrado GPS**: Solo acepta puntos con precisión <30m
- **Suavizado de ruta**: Elimina ruido y picos anómalos
- **Validación de velocidad**: Detecta ritmos imposibles (>3:00 min/km o <10:00 min/km)
- **Límites por nivel**: Territorios máximos basados en experiencia
- **Validación de área**: Previene polígonos absurdamente grandes
- **Distancia mínima**: 100m para registrar carrera válida

### 📱 Experiencia de Usuario
- **PWA**: Instalable como app nativa
- **Filtros de mapa**: Visualiza solo tus territorios, de amigos o todos
- **Confirmación de parada**: AlertDialog antes de finalizar carrera
- **Pausa incluida**: Detén temporalmente sin perder progreso
- **Récords personales**: Mejor ritmo, carrera más larga, más territorios
- **Responsive**: Funciona en móvil, tablet y desktop
- **Notificaciones push**: Recibe alertas en tiempo real cuando atacan o roban tus territorios
- **Replays animados**: Revive cada carrera desde el feed o tu historial con un modo espectador en el mapa

---

## 🏗️ Stack Tecnológico

### Frontend
- **React 18** con TypeScript
- **Vite** - Build tool ultrarrápido
- **Tailwind CSS** - Sistema de diseño responsive
- **Shadcn/ui** - Componentes accesibles y customizables
- **React Router** - Navegación SPA
- **React Query** - Gestión de estado servidor

### Mapas y Geolocalización
- **Mapbox GL JS** - Renderizado de mapas vectoriales
- **Geolocation API** - Tracking GPS en tiempo real
- **Turf.js** (utilidades de geoCalculations) - Cálculos geoespaciales

### Backend (Supabase)
- **PostgreSQL** - Base de datos relacional
- **Row Level Security (RLS)** - Seguridad a nivel de fila
- **Edge Functions** - Serverless functions
- **Real-time subscriptions** - Actualizaciones en vivo
- **Authentication** - Sistema de usuarios completo

### DevOps
- **GitHub Integration** - Sync bidireccional
- **PWA** - Service workers, caché, offline-first

---

## 🎮 Mecánicas del Juego

### Conquistar Territorios

1. **Iniciar carrera** → Botón "Start Run"
2. **Correr formando polígono** → El GPS registra tu ruta
3. **Cerrar el polígono** → Termina cerca del punto de inicio
4. **Finalizar carrera** → Se calcula área, puntos y territorios

**Puntos otorgados:**
```
Puntos = redondear(Distancia km × 10)
       + ⌊Área m² / 2000⌋
       + Bonus (50 si es nuevo / 75 si es robo)
```

### Robar Territorios

Para conquistar un territorio ajeno necesitas:
- ✅ Pasar por encima del territorio
- ✅ Superar el ritmo promedio del dueño actual
- ✅ Que no esté en protección (24h desde conquista)
- ✅ Que haya pasado el cooldown (6h desde tu último intento)
- ✅ Superar el bonus de defensa del dueño

**Bonus de defensa por nivel:**
- Nivel 1-5: +0.5 min/km
- Nivel 6-10: +0.75 min/km
- Nivel 11+: +1.0 min/km

### Sistema de Niveles

```typescript
Nivel = Math.floor(Math.sqrt(total_distance / 5)) + 1
```

**Límites de territorio por nivel:**
- Nivel 1-5: 10 territorios máx
- Nivel 6-10: 25 territorios máx
- Nivel 11-15: 50 territorios máx
- Nivel 16+: 100 territorios máx

> El área máxima de cada territorio también escala con tu nivel: empieza en 0.2 km² y suma 0.05 km² por nivel hasta un tope de 5 km². Si superas ese límite, la carrera se rechaza automáticamente.

### Validaciones de Carrera

✅ **Carrera válida si:**
- Distancia ≥ 100m
- Precisión GPS < 30m en la mayoría de puntos
- Ritmo entre 3:00 - 10:00 min/km
- Área de territorios dentro del límite del nivel
- No hay saltos de velocidad anómalos

❌ **Carrera rechazada si:**
- GPS muy impreciso consistentemente
- Velocidad imposible (bici, coche, teletransporte)
- Polígono demasiado grande para tu nivel
- Distancia < 100m

---

## 📊 Estructura del Proyecto

```
src/
├── components/           # Componentes React
│   ├── ui/              # Componentes base (shadcn)
│   ├── Auth.tsx         # Login/Registro
│   ├── MapView.tsx      # Mapa principal con filtros
│   ├── RunControls.tsx  # Controles de carrera (Start/Pause/Stop)
│   ├── RunSummary.tsx   # Resumen post-carrera
│   ├── Profile.tsx      # Perfil con récords personales
│   ├── Friends.tsx      # Gestión de amigos
│   ├── Achievements.tsx # Logros desbloqueados
│   ├── Challenges.tsx   # Desafíos semanales
│   ├── ActivityFeed.tsx # Feed social
│   ├── Notifications.tsx# Centro de notificaciones
│   └── Tutorial.tsx     # Guía inicial
│
├── hooks/               # Custom React hooks
│   ├── useRun.ts       # Lógica completa de carreras
│   ├── useAchievements.ts # Sistema de logros
│   └── use-mobile.tsx  # Detección responsive
│
├── utils/               # Utilidades y lógica de negocio
│   ├── geoCalculations.ts    # Cálculos geoespaciales
│   ├── levelSystem.ts        # Sistema de niveles y XP
│   ├── runValidation.ts      # Validaciones anti-exploit
│   ├── territoryProtection.ts# Sistema de protección
│   └── territoryStorage.ts   # Almacenamiento local
│
├── contexts/            # React Context
│   └── AuthContext.tsx # Estado de autenticación
│
├── integrations/        # Integraciones externas
│   └── supabase/       # Cliente y tipos de Supabase
│
├── pages/              # Páginas principales
│   ├── Index.tsx       # Home/Dashboard
│   └── NotFound.tsx    # 404
│
└── types/              # TypeScript types
    └── territory.ts    # Tipos de territorios

supabase/
├── functions/          # Edge Functions
│   └── get-mapbox-token/ # Proxy seguro para Mapbox token
│   └── process-territory-claim/ # Valida y procesa conquistas/robos
│   └── send-engagement-pings/ # Recordatorios automáticos
└── migrations/         # Migraciones de DB
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

**profiles**
- Información del usuario
- Estadísticas acumuladas (distancia, territorios, puntos)
- Color personalizado para el mapa
- Sistema de rachas (streaks)

**runs**
- Historial de carreras
- Ruta GPS (path JSON)
- Métricas (distancia, duración, ritmo)
- Territorios conquistados/perdidos

**territories**
- Polígonos conquistados
- Coordenadas (GeoJSON)
- Usuario propietario
- Área, perímetro, puntos
- Ritmo promedio (para robo)

**achievements**
- Definición de logros
- Tipos: distancia, territorios, streak
- Requisitos y recompensas

**user_achievements**
- Relación usuario-logro
- Fecha de desbloqueo

**challenges**
- Desafíos semanales activos
- Objetivos y recompensas

**challenge_participations**
- Progreso de usuarios en desafíos

**friendships**
- Relaciones de amistad
- Estados: pending, accepted

**notifications**
- Sistema de notificaciones
- Tipos: achievement, challenge, friend, territory

**territory_events**
- Historial de conquistas/robos/refuerzos
- Guarda atacante, defensor, ritmo, área y resultado

**push_subscriptions**
- Suscripciones Web Push por usuario
- Endpoint + claves (p256dh/auth) para enviar notificaciones del sistema

**map_challenges**
- Retos geolocalizados que aparecen como pines
- Cada uno tiene nombre, radio, fechas y recompensa

**map_challenge_claims**
- Registro de qué usuario completó cada reto del mapa
- Controla que sólo se reclame una vez por jugador

---

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js 18+ y npm
- Cuenta de Supabase
- API key de Mapbox
  - Si necesitas desplegar desde la CLI oficial y no tienes Node 20+, descarga el binario desde GitHub o usa Docker (`docker run supabase/cli ...`).
- Par de claves VAPID para Web Push (configura los secretos `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY` y `PUSH_CONTACT_EMAIL`).

### Configuración

1. **Clonar repositorio**
```bash
git clone <YOUR_GIT_URL>
cd urbanz
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crear archivo `.env`:
```env
# Supabase (ya configurado en el código)
# SUPABASE_URL=https://mingyhynzeoawsjnnpwj.supabase.co
# SUPABASE_ANON_KEY=...

# Mapbox
MAPBOX_TOKEN=tu_mapbox_public_token

# Web Push
VITE_VAPID_PUBLIC_KEY=tu_clave_publica_vapid_base64
```

4. **Configurar Supabase Edge Function Secret**

En Supabase Dashboard → Settings → Edge Functions:
- Añadir secret: `MAPBOX_TOKEN` con tu token público de Mapbox
- Añadir secrets para Web Push:
  - `PUSH_VAPID_PUBLIC_KEY`
  - `PUSH_VAPID_PRIVATE_KEY`
  - `PUSH_CONTACT_EMAIL` (correo de contacto para VAPID)

5. **Iniciar desarrollo**
```bash
npm run dev
```

La app estará en `http://localhost:8080`

### Despliegue

```bash
# Build
npm run build

# Deploy frontend (Vercel, Netlify, etc.)
# Los edge functions se despliegan automáticamente en Supabase

# Desplegar la función de territorios
/ruta/al/supabase functions deploy process-territory-claim

# Desplegar migraciones/infra (asegúrate de tener supabase link configurado)
/ruta/al/supabase db push
```

---

## 🔐 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:
- **profiles**: Los usuarios solo ven/editan su propio perfil
- **runs**: Cada usuario solo accede a sus carreras
- **territories**: Visibles públicamente, editables solo por dueño
- **friendships**: Solo participantes ven la relación
- **notifications**: Solo el destinatario accede

### Validaciones

**Cliente (TypeScript):**
- Filtrado GPS por precisión
- Detección de velocidades anómalas
- Límites de área por nivel

**Servidor (PostgreSQL):**
- Triggers de validación
- Constraints de integridad
- Checks de relaciones

---

## 🎨 Sistema de Diseño

### Colores (HSL en index.css)
```css
--primary: [color principal de marca]
--secondary: [color secundario]
--accent: [color de énfasis]
--muted: [color atenuado para fondos]
--foreground: [texto sobre background]
--primary-foreground: [texto sobre primary]
```

### Componentes
- Todos usan tokens semánticos de Tailwind
- Variantes definidas con `class-variance-authority`
- Responsive por defecto
- Dark mode ready

---

## 🔮 Roadmap y Futuras Mejoras

### En desarrollo
- [ ] Sistema de escudos protectores (consumibles)
- [ ] Desafíos 1v1 entre amigos
- [ ] Heatmap de zonas más disputadas
- [ ] Rankings especializados (ritmo, distancia, etc.)

### Planificado
- [ ] Sistema de temporadas con reset mensual
- [ ] Clanes y territorios de equipo
- [ ] Eventos especiales y territorios premium
- [ ] Modo offline con sincronización
- [ ] Notificaciones push nativas
- [ ] Integración con wearables (Garmin, Strava)
- [ ] Achievements más complejos y rareza
- [ ] Replay 3D de carreras

### Considerando
- [ ] Marketplace de items y cosméticos
- [ ] Sistema de energía/stamina
- [ ] Batallas por territorios en tiempo real
- [ ] Monetización (premium features, ads)

---

## 🤝 Contribuir

Este es un proyecto en desarrollo activo. Si quieres contribuir:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo licencia MIT. Ver archivo `LICENSE` para más detalles.

---

## 🙏 Agradecimientos

- **Mapbox** por las increíbles herramientas de mapeo
- **Supabase** por el backend completo y fácil de usar
- **Shadcn/ui** por los componentes de alta calidad
- **Comunidad de runners** por el feedback continuo

---

## 📞 Contacto y Soporte

- **GitHub**: [Tu repositorio]
- **Issues**: Reporta bugs y sugiere features en GitHub Issues

---

**¡Sal a correr y conquista tu ciudad! 🏃‍♂️🗺️**
