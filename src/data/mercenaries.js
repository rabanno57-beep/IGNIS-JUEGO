// Clases de mercenarios de Marck. Cada una cambia el combate de forma distinta (ver combat/battle.js).
// vision/hear: rango de detección en píxeles en el mundo. speed: velocidad de persecución.

export const MERC = {
  raso: {
    name: 'Mercenario raso', hp: 24, atk: 6, def: 0, xp: 8, vision: 150, speed: 80, color: '#8a6a3a',
    desc: 'Trabajador armado. Ataques físicos simples; enseña el combate.',
    strategy: 'Embiste cada tanto: se anuncia con el indicador.',
  },
  armado: {
    name: 'Mercenario armado', hp: 20, atk: 9, def: 0, xp: 12, vision: 170, speed: 72, color: '#5b7b4a', ranged: true,
    desc: 'Dispara a distancia. Apunta un turno y dispara al siguiente.',
    strategy: 'Defiéndete, usa raíces protectoras o interrumpe el apunte con el gancho.',
  },
  defensa: {
    name: 'Mercenario de defensa', hp: 34, atk: 6, def: 3, xp: 14, vision: 140, speed: 66, color: '#707a85',
    desc: 'Se cubre con un escudo y resiste casi todo el daño mientras guarda.',
    strategy: 'Rompe su guardia con el gancho o las lianas.',
  },
  explorador: {
    name: 'Mercenario explorador', hp: 18, atk: 5, def: 0, xp: 12, vision: 210, speed: 100, color: '#b09a5a', alerts: true,
    desc: 'Patrulla caminos con vista aguda. En combate llama refuerzos si no cae a tiempo.',
    strategy: 'Derrótalo antes de que termine la cuenta del silbato.',
  },
  veterano: {
    name: 'Mercenario veterano', hp: 48, atk: 10, def: 2, xp: 24, vision: 170, speed: 84, color: '#8a3b3b',
    desc: 'Más resistente. Alterna Culatazo (te drena savia) y Ráfaga (varios disparos).',
    strategy: 'Guarda savia para raíces y vigila su patrón.',
  },
  comandante: {
    name: 'Comandante Duarte', hp: 110, atk: 12, def: 4, xp: 80, vision: 190, speed: 80, color: '#2a2a33', boss: true,
    desc: 'Coordina a los trabajadores armados: da órdenes, pide refuerzos y se enfurece a media vida.',
    strategy: 'Elimina a su escolta o aguanta sus órdenes; en la segunda fase usa humo y fuego cruzado.',
  },
  elite: {
    name: 'Mercenario de élite', hp: 64, atk: 12, def: 3, xp: 40, vision: 190, speed: 90, color: '#1d1d22', ranged: true,
    desc: 'Guardia de la excavación. Disparo de precisión que atraviesa defensa y raíces, y guardia táctica.',
    strategy: 'Rompe su guardia y no dependas solo de defender.',
  },
};
