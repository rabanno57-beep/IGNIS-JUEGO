# Root Knight — El secreto del bosque

Primera aventura jugable basada en el relato *El secreto del bosque* (PDF incluido): Eduardo, excavador de Tzakan, se convierte en el Avatar **Root Knight** para detener a **Marck** y a sus mercenarios, que talan el bosque buscando un antiguo amuleto.

JavaScript vanilla + Canvas, módulos ES, sin dependencias ni build.

## Cómo jugar

Los módulos ES no funcionan con `file://`; sirve la carpeta con cualquier servidor estático:

```
python -m http.server 8123      # y abre http://localhost:8123
```

| Acción | Tecla (reasignable en Opciones) |
|---|---|
| Mover | WASD / flechas |
| Interactuar / avanzar diálogo | E, Espacio, Enter |
| Camuflaje (reduce mucho la detección) | C |
| Gancho: viajar entre anclajes / atraer a un mercenario desprevenido | Q |
| Emboscada cuerpo a cuerpo | F |
| Pausa | Esc |
| Menús de combate | clic o teclas 1–9 |

## Guardado

> **Importante:** el guardado usa **LocalStorage del navegador**. Depende de ese navegador, ese perfil y ese origen (dirección/puerto): si borras los datos del sitio, usas otro navegador u otro equipo, o abres el juego desde otra dirección, **no verás tu partida y se puede perder**. **No existe sincronización en la nube** ni cuentas.

- **Automático** (agrupado, 200 ms): misión completada/iniciada, objeto obtenido, habilidad desbloqueada, subida de nivel, cofre abierto, secreto descubierto, cambio de zona, mercenario derrotado, y al ocultar/cerrar la pestaña. No guarda a mitad de un combate; guarda al terminar.
- **Manual:** *Pausa → Guardar partida* y **puntos de guardado** en el mundo (además restauran vida y savia).
- **Título:** *Nueva partida* y *Continuar*; *Continuar* solo se habilita con una partida válida y muestra zona, nivel y fecha. *Nueva partida* pide confirmación si ya existe una.
- **Indicadores:** icono «Guardando…» y aviso «✔ Partida guardada»; errores visibles.
- **Datos guardados:** zona y posición, capítulo y banderas de historia, misiones activas/completadas, nivel/XP/estadísticas, habilidades, inventario, cofres, secretos, enemigos derrotados, puntos de guardado activados, audio y controles, tiempo de juego y fecha de guardado.
- **Protección:** envoltorio `{version, savedAt, checksum, data}`; escritura a clave temporal + verificación + copia `rootknight.save.bak` del guardado anterior; se rechaza sobrescribir una partida con progreso por un estado vacío (salvo «Nueva partida» confirmada); JSON ilegible o checksum incorrecto = partida corrupta (se intenta la copia `.bak` y el texto dañado se conserva en `rootknight.save.corrupt`, nunca se borra); versiones antiguas se migran (`src/save/migrations.js`); una versión más nueva no se carga ni se sobrescribe; cuota llena o almacenamiento bloqueado producen un error, nunca una excepción.
- **Preparado para la nube:** `SaveManager` solo usa la interfaz `{read, write, remove}` de `src/save/storage.js`. Un futuro adaptador remoto cumpliría la misma interfaz. **No está implementado.**

Ajustes de estructura: `src/save/` (schema, migraciones, almacenamiento, `SaveManager`).

## Mercenarios de Marck

Enemigos principales, visibles en el mapa (patrullan por rutas o guardan campamentos; conos de visión). Si te detectan te persiguen y se inicia el combate; el camuflaje y los arbustos reducen el rango de detección. Derrotados no reaparecen (se guardan por ID); huir los devuelve a su puesto.

| Clase | Diferencia funcional |
|---|---|
| Raso | Golpes simples y embestida telegrafiada; enseña el combate |
| Armado | **Apunta un turno y dispara al siguiente** (a distancia); la defensa lo mitiga y el gancho interrumpe el apunte |
| Defensa | **Guardia**: recibe ~25 % del daño hasta que el gancho/lianas la rompen |
| Explorador | Visión larga, **alerta a compañeros** en el mapa; en combate llama refuerzos (cuenta atrás visible) |
| Veterano | Culatazo (drena savia) y Ráfaga (3 disparos) |
| Comandante Duarte | Jefe intermedio: da órdenes (buff), pide refuerzos, 2 fases (humo, fuego cruzado); resiste el aturdimiento; cae → escena de la rampa |
| Élite | Disparo de precisión que **atraviesa defensa y raíces**, guardia táctica; solo en excavación y templo |

El combate por turnos muestra la **intención** de cada enemigo antes de que actúe. Respuestas del jugador: golpear, macuahuitl, gancho, raíces protectoras, lianas, troncos, objetos, defender y huir. Ganar da XP y botín; **perder nunca bloquea** (Reintentar / Cargar último guardado / Menú principal).

## Marck (sistema separado: `src/combat/marck.js`)

No es un mercenario: tiene su propio controlador con reserva de **agua** (el río), **presión** acumulada que desemboca en aplastamiento, esquiva/bloqueo, y sigue el libro: el poder vegetal **despierta** durante el combate (Troncos y Sauces), los **sauces absorben el agua**, Marck los corta, y al caer se retira por el río mientras Root Knight devuelve el amuleto al templo. El epílogo termina con la entrada rompiéndose y el azul marino emergiendo.

## Estructura

```
index.html, style.css
src/main.js              arranque, bucle, escenas, autoguardado
src/core/                eventos, estado de juego, input, audio
src/save/                formato, migraciones, almacenamiento, SaveManager
src/data/                zonas, mercenarios, misiones/objetos/habilidades, historia
src/world/world.js       movimiento, colisiones, patrullas, detección, interacciones
src/combat/              battle.js (motor + IA de mercenarios), marck.js
src/ui/                  DOM (menús, diálogos, HUD) y sprites en canvas
tests/                   unitarias (node) y e2e (navegador)
```

## Pruebas realizadas

Fecha: 2026-10-20. Chrome (headless, Windows 11) vía Playwright; Node 24.

**Automáticas (reproducibles)**
- `node tests/save.test.mjs` — 14 pruebas OK: round-trip, estado vacío no sobrescribe progreso, `allowReset`, estado inválido, JSON corrupto (se conserva), checksum erróneo, recuperación desde `.bak`, migración v1→v2, versión futura, cuota llena, almacenamiento que lanza, eventos, borrado.
- `node tests/zones.test.mjs` — mapas OK: spawn, cofres, secretos, savepoints, NPC y salidas alcanzables (con anclajes de gancho); rutas de patrulla libres de obstáculos.
- `tests/e2e/*.mjs` (requieren `npm i playwright-core`, Chrome y el servidor en el puerto 8123; ajusta la ruta de Chrome):
  - **persistence**: nueva partida → mover → *guardar manual* → autoguardado por eventos (objeto, nivel, misión, cofre) → **cerrar la pestaña y reabrir** → *Continuar* habilitado → zona, capítulo, banderas, misiones, jugador, habilidades, inventario, cofres, posición y ajustes **idénticos**. Confirmación de *Nueva partida* (cancelar conserva el guardado). Guardado corrupto en el navegador → aviso y recuperación de la copia.
  - **world**: Ximón → inscripción → transformación en Root Knight; camuflaje reduce el rango de detección (120 → 42 px); detección → persecución → combate; el explorador alerta a otros; cofre; savepoint (cura y guarda); barricada bloquea hasta completar la misión; zona nueva; derrotados no reaparecen tras recargar.
  - **combat**: victoria contra cada clase; comandante con escolta (gana con nivel ≥5 y estrategia simple, pierde con nivel 4); derrota → pantalla con 3 opciones → *Reintentar*; **combate completo contra Marck** (despertar, sauces, victoria, banderas e hitos de misión).
- Sin errores de consola ni de página en ninguna ejecución.

**No probado**
- Otros navegadores (Firefox, Safari), móvil/táctil, ni teclados no QWERTY más allá de poder reasignar teclas.
- Modo privado real (se simuló solo con almacenamiento que lanza en pruebas unitarias).
- Una partida completa jugada de principio a fin a mano; los e2e saltan tramos (p. ej. teletransportan al jugador) para llegar a cada sistema.
- Equilibrio fino: los combates se probaron con una estrategia automática simple.

## Problemas pendientes / decisiones de diseño

- **Raíces y lianas antes del despertar:** el libro presenta el poder vegetal como un despertar durante el combate con Marck. Para que el jugador pueda usarlas contra mercenarios, *Raíces protectoras* (nv 2) y *Lianas* (nv 3) se tratan como técnicas del traje que se revelan al subir de nivel; **Troncos y Sauces** sí se despiertan solo frente a Marck. Es una licencia respecto al libro.
- **Invenciones propias** (no están en el relato): nombre «Comandante Duarte», las clases de mercenario (propuestas de diseño), los escritos del templo, algunos diálogos de enlace y los objetos/misiones secundarias.
- La posición de los mercenarios no se guarda (reaparecen en su puesto al cargar; los derrotados no). Al recargar durante una persecución, el jugador reaparece donde guardó.
- No hay música; solo efectos sintetizados. No hay controles táctiles.
- Los combates no se guardan: se guarda al terminarlos.
- `window.rootKnight` queda expuesto para depuración/pruebas.
- El mapa del libro (pueblo, templo al aire libre, templo subterráneo) está simplificado a 4 zonas.
