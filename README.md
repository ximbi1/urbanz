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
- **Centro de defensa**: Compra o reclama escudos (consumibles o por logros) y aplícalos a tus territorios para 12h/24h de protección.
- **Duelos 1v1**: Reta a tus amigos a carreras de distancia/puntos o arenas neutrales y gana recompensas adicionales.

### 🎮 Progresión y Gamificación
- **Sistema de niveles**: Gana XP por distancia, territorios y actividad
- **Logros desbloqueables**: Por distancia, territorios y rachas
- **Misiones rotativas**: Ciclo de 10 días con 3 misiones activas; cada 2 días rotan
- **Misiones de fin de semana**: Retos especiales sábado/domingo con mejores recompensas (+50% puntos, +escudos)
- **Puntos y ligas**: Sistema competitivo global y entre amigos

### 👥 Social
- **Sistema de amigos**: Invita, acepta, compite
- **Ligas competitivas**:
  - Global: Top runners del mundo
  - Amigos: Compite solo con tu círculo
- **Liga Social**: Modo alternativo donde corres en grupo y los territorios se comparten; actívalo desde tu perfil
- **Feed de actividad**: Ve las carreras y conquistas recientes
- **Notificaciones**: Alertas de logros, desafíos y actividad social
- **Duelos 1v1**: Lanza retos personalizados a tus amigos y desbloquea recompensas extra

### 🛡️ Protección Anti-Exploit
- **Filtrado GPS**: Solo acepta puntos con precisión <30m
- **Suavizado de ruta**: Elimina ruido y picos anómalos
- **Validación de velocidad**: Detecta ritmos imposibles (>3:00 min/km o <10:00 min/km)
- **Límites por nivel**: Territorios máximos basados en experiencia
- **Validación de área**: Previene polígonos absurdamente grandes
- **Distancia mínima**: 100m para registrar carrera válida

### 📱 Experiencia de Usuario
- **PWA**: Instalable como app nativa (https://urbanz-gamma.vercel.app)
- **Filtros de mapa**: Visualiza solo tus territorios, de amigos o todos
- **Capas OSM**: Parques, fuentes y barrios reales (polígonos importados de OpenStreetMap) con toggles independientes
- **Barrios interactivos**: El contorno se resalta al tocarlo y muestra área/perímetro para saber cuánto debes rodear
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
- **Datasets OSM** - Polígonos de parques/fuentes/barrios cargados directamente en Supabase

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

## 📱 Integración con Capacitor (Node 18.x)

Para empaquetar la PWA como apps nativas usamos **Capacitor 6**, compatible con Node 18.17 del entorno actual. Si actualizas Node ≥20 podrás saltar a Capacitor 7 sin cambios mayores.

### 1. Setup inicial
- `npx cap init URBANZ com.urbanz.app --web-dir dist`
- `npm install -D @capacitor/cli@6 && npm install @capacitor/core@6`
- Plataformas: `npm install @capacitor/ios@6 @capacitor/android@6` seguido de `npx cap add ios` y `npx cap add android`.
- Cada build web (`npm run build`) debe ir seguido de `npx cap copy` (o `sync`) para volcar `dist/` en los proyectos nativos.

### 2. Plugins instalados
- `@capacitor/geolocation@6`, `@capacitor/push-notifications@6`, `@capacitor/haptics@6`
- `@capacitor-community/keep-awake@5`
- `@transistorsoft/capacitor-background-fetch@6` (último release compatible con Capacitor 6).

### 3. Permisos nativos mínimos
- **iOS (`ios/App/App/Info.plist` + `AppDelegate.swift`)**: ya se declararon `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `UIBackgroundModes` y `locationManager.allowsBackgroundLocationUpdates = true`. Ajusta los textos si cambias el copy o las políticas de privacidad.
- **Android (`android/app/src/main/AndroidManifest.xml`)**: permisos de ubicación/background, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED` y el servicio `RunTrackingService` están listos. El plugin `RunTrackingPlugin` expone `startService/stopService` (envueltos en `src/lib/runTracking.ts`) y `useRun` ya lo invoca cuando empieza/termina una carrera real.

### 4. Hooks a adaptar
- `useGeolocation`: detecta `Capacitor.isNativePlatform()` → usa `Geolocation.watchPosition`. En Android background delega al servicio foreground.
- `usePushNotifications`: solicita permiso, registra token y listeners con `PushNotifications` sin romper el fallback web (mantén `navigator.geolocation`/Service Worker push).
- `useRun`: al iniciar carrera nativa enciende `KeepAwake` + `Haptics` y llama al servicio foreground Android; libera recursos al finalizar.
- Mantén los codepaths web activos para la versión browser/PWA.

### 6. Web/PWA para pruebas
- **URL**: https://urbanz-gamma.vercel.app/
- Puedes instalarla como app de escritorio (PWA) desde el navegador:
  - En Chrome/Edge: abre la URL, pulsa el icono de instalación en la barra de direcciones o “Instalar aplicación” en el menú ⋮. 
  - En iOS/Android (Safari/Chrome): “Añadir a pantalla de inicio” desde el menú de compartir/opciones. 
  - Esto crea un icono y abre la app a pantalla completa con el service worker (modo offline y notificaciones web si concedes permiso).

### 5. Flujo de desarrollo nativo
- Lanza `npx cap sync` tras modificar plugins o `capacitor.config.ts`.
- Usa `npx cap open ios` / `npx cap open android` para abrir Xcode/Android Studio y probar en simulador o dispositivo real.
- Documenta en Supabase (cron) cómo usar `rebalance-shards` si habilitas el refresco background, y añade al README del proyecto nativo cómo activar el “modo explorador/liga social”.

Con estos pasos puedes iterar sobre la app web y móvil en paralelo sin duplicar código.

---

## 🎮 Mecánicas del Juego

### Conquistar Territorios

1. **Iniciar carrera** → Botón "Start Run"
2. **Correr formando polígono** → El GPS registra tu ruta
3. **Cerrar el polígono** → Termina cerca del punto de inicio
4. **Finalizar carrera** → Se calcula área, puntos y territorios

#### Reglas actuales (cliente + función `process-territory-claim`)
- **Área**: mínimo 50 m², máximo global 5 km² (ya no depende del nivel).
- **Múltiples territorios por carrera**: detectamos bucles cerrados dentro de una misma ruta; cada bucle válido se guarda como territorio independiente. Si no cierras manualmente, autocerramos la ruta uniendo el último punto con el primero.
- **Robos parciales**: aunque el solape sea alto, sólo se roba la porción recorrida. El territorio defensor se recorta (difference) y el atacante recibe un territorio nuevo con el área robada. Protecciones (24h), cooldown (6h), ritmo requerido y escudos siguen aplicando.
- **Refuerzo**: si es tu territorio y el solape es significativo, se actualiza el territorio existente (área/ritmo) y queda protegido.
- **Validaciones**: velocidad media ≤25 km/h; ritmo no estático (>30 min/km se rechaza); patrón anti-saltos; polígono cerrado (o autocierre) para ser válido.

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

## 📊 Estructura del Proyecto (web + móvil compartido)

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

> PWA listo: el repo incluye `manifest.json` e iconos, así que puedes instalar URBANZ desde el navegador (Chrome → “Añadir a pantalla de inicio”). También puedes usar directamente la build hospedada en https://urbanz-gamma.vercel.app/ y “Instalar aplicación” en la barra de direcciones.

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

### ✅ Lanzado recientemente
- [x] Sistema de escudos protectores (compra/aplicación y visualización en mapa)
- [x] Duelos 1v1 con amigos y tracking automático
- [x] Temporadas con puntuación de season y reset mediante función programada
- [x] Importación de archivos GPX/TCX y replay 3D de carreras
- [x] Modo offline + sincronización diferida de carreras (con banner en home)
- [x] Misiones dinámicas basadas en parques, fuentes y barrios de OSM
- [x] **Liga Social**: Modo cooperativo donde los territorios se comparten con el grupo
- [x] **Misiones rotativas**: Ciclo de 10 días con 3 misiones; cambian cada 2 días
- [x] **Misiones de fin de semana**: Retos especiales sábado/domingo con +50% recompensas y escudos

### En desarrollo
- [ ] Heatmap de zonas más disputadas y hotspots de robos
- [ ] Rankings especializados (ritmo, distancia, constancia, defensores)
- [ ] Notificaciones de nuevas misiones disponibles

### Planificado
- [ ] Clanes/escuadras y territorios compartidos permanentes
- [ ] Eventos especiales y territorios premium patrocinados
- [ ] Notificaciones push nativas y campañas in-app
- [ ] Integración con wearables (Garmin, Strava, Apple Watch) y auto-sync
- [ ] Achievements con rareza y recompensas cosméticas
- [ ] Herramientas de entrenamiento: ghost runs, planes de ritmo, coach IA

### Considerando
- [ ] Marketplace de items/cosméticos y economía soft
- [ ] Sistema de energía/stamina y power-ups temporales
- [ ] Batallas en tiempo real / matchmaking en vivo
- [ ] Modo espectador y streaming de conquistas
- [ ] Contenido UGC: editor de rutas y retos comunitarios

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
