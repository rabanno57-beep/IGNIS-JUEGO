// Objetos, habilidades y misiones. Datos puros.

export const ITEMS = {
  hierba: { name: 'Hierba curativa', type: 'consumible', desc: 'Restaura 30 de vida.', heal: 30 },
  tonico: { name: 'Tónico de resina', type: 'consumible', desc: 'Restaura 60 de vida.', heal: 60 },
  savia: { name: 'Savia viva', type: 'consumible', desc: 'Restaura 5 de savia.', energy: 5 },
  fragmento_glifo: { name: 'Fragmento de glifo', type: 'reliquia', desc: 'Pieza de un escrito de la civilización antigua.' },
  plano_excavacion: { name: 'Plano de excavación', type: 'misión', desc: 'Muestra cómo llegar al templo subterráneo.' },
};

// unlockLevel: se desbloquea al subir a ese nivel (técnicas que el traje va revelando).
export const SKILLS = {
  strike: { name: 'Puños y patadas', cost: 0, desc: 'Ataque físico básico.' },
  macuahuitl: { name: 'Macuahuitl', cost: 2, unlockFlag: 'suit', desc: 'Arma prehispánica oculta en el traje. Daño alto.' },
  hook: { name: 'Gancho', cost: 1, unlockFlag: 'suit', desc: 'Atrae al enemigo: aturde, interrumpe disparos y rompe guardias.' },
  roots: { name: 'Raíces protectoras', cost: 3, unlockLevel: 2, desc: 'Un muro de raíces absorbe daño durante 3 turnos.' },
  vines: { name: 'Lianas', cost: 3, unlockLevel: 3, desc: 'Inmoviliza al enemigo 2 turnos y rompe su guardia.' },
  trunks: { name: 'Troncos', cost: 4, desc: 'Dos troncos aplastan al objetivo. Se despierta frente a Marck.' },
  willows: { name: 'Sauces', cost: 3, desc: 'Sauces que absorben el agua de Marck. Se despierta frente a Marck.' },
  camouflage: { name: 'Camuflaje', cost: 0, unlockFlag: 'suit', desc: 'Mueve el traje con las hojas: reduce mucho la detección (tecla C).' },
};

// goal: defeat (todos los ids derrotados) | flag | item {id, n}
export const QUESTS = {
  q_escrito: {
    title: 'El escrito del templo',
    desc: 'Habla con Ximón y descifra el escrito antiguo del templo.',
    goal: { type: 'flag', flag: 'suit' },
    reward: { xp: 0 }, next: 'q_tala',
  },
  q_tala: {
    title: 'Detener la tala',
    desc: 'Derrota a los mercenarios clave del campamento de Marck: raso, armado, defensa y explorador.',
    goal: { type: 'defeat', ids: ['b_raso1', 'b_armado1', 'b_defensa1', 'b_explor1'] },
    reward: { xp: 30, items: { hierba: 2 } }, setFlag: 'camp_cleared',
    next: 'q_planos',
  },
  q_planos: {
    title: 'Los planos de Marck',
    desc: 'Cruza la excavación y vence al Comandante que guarda el acceso al templo.',
    goal: { type: 'defeat', ids: ['e_comandante'] },
    reward: { xp: 60, items: { plano_excavacion: 1, tonico: 1 } }, next: 'q_artefacto',
  },
  q_artefacto: {
    title: 'El artefacto',
    desc: 'Llega al fondo del templo subterráneo y detén a Marck antes de que tome el amuleto.',
    goal: { type: 'flag', flag: 'marck_defeated' },
    reward: { xp: 150 },
  },
  q_glifos: {
    title: 'Glifos olvidados',
    desc: 'Ximón cree que hay fragmentos de escrituras escondidos por el bosque. Reúne 3.',
    goal: { type: 'item', id: 'fragmento_glifo', n: 3 },
    reward: { xp: 40, items: { savia: 2, tonico: 1 } },
  },
};
