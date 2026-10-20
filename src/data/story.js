// Diálogos y escenas. Basado en "El secreto del bosque".
import { flag } from '../core/state.js';

const T = (text) => ({ text, thought: true });
const E = (text) => ({ who: 'Eduardo', text });

export function npcDialog(id) {
  if (id === 'ximon') {
    if (!flag('met_ximon')) return { flagSet: 'met_ximon', quest: 'q_glifos', lines: [
      { who: 'Ximón', text: '—¿Puedes creerlo? Van a talar todo el bosque. Si lo hacen nos quedamos sin empleo… y sin pueblo.' },
      E('—No solo perderíamos nuestros empleos. Perderíamos todo.'),
      { who: 'Ximón', text: '—Lástima que no podamos hacer nada. Por cierto, necesitan que sigas descifrando el escrito del templo, al este de la plaza.' },
      { who: 'Ximón', text: '—Y si ves fragmentos de glifos tirados por ahí, guárdalos. Con tres podríamos reconstruir una inscripción entera.' },
    ] };
    return { lines: [{ who: 'Ximón', text: '—El templo está al este, pasando la plaza. Cuando lo descifres, avísame.' }] };
  }
  return { lines: [
    { who: 'Doña Rosa', text: flag('suit') ? '—Dicen que algo se mueve entre los árboles… ¡Que el bosque nos proteja!' : '—Esos hombres con el permiso del gobierno no me dan buena espina. El bosque es sagrado, hijo.' },
  ] };
}

export const SCENES = {
  intro: [
    T('Me desperté sudando después de un sueño raro: maquinaria pesada llegaba al pueblo para talar nuestros bosques en busca de algo escondido…'),
    T('Un hombre grande parecía ser el jefe. Y una voz decía mi nombre: debía entrar al bosque para despertar el poder dentro de mí.'),
    T('Será mejor ir a la plaza. Es mi pueblo, Tzakan. Y algo malo está por pasar.'),
  ],
  inscription: [
    T('El templo está al aire libre; desde aquí se aprecia la profundidad del bosque. Me acerco al escrito de la antigua civilización…'),
    { who: 'Voz', text: '—Eduardo…' },
    T('Me volteo, pero no hay nadie. El bosque parece llamarme y mi cuerpo se mueve solo. De pronto todo se oscurece.'),
  ],
  suit: [
    T('Me despierto en una zona desconocida del bosque. Al apoyar las manos en el río, las veo cubiertas de hojas… y mi reflejo es el de otra persona.'),
    T('Una capucha cubre mi cabeza y una máscara de hojas deja ver solo mis ojos. El traje esconde armas, entre ellas un gancho y un macuahuitl.'),
    { who: 'Guardián de la naturaleza', text: '—Soy el guardián del bosque. Eres descendiente de mi antiguo Avatar: ahora eres el nuevo. Serás el vigilante Root Knight.' },
    { who: 'Guardián de la naturaleza', text: '—El traje te da fuerza y protección, te camufla con el bosque y te guía. Hay hombres que buscan un artefacto antiguo y vienen a dañar este pueblo. Detenlos.' },
    E('—No soy fuerte y jamás he peleado en mi vida…'),
    { who: 'Guardián de la naturaleza', text: '—Avanza. El bosque te guiará.' },
    { text: 'Camuflaje (C): reduce mucho tu detección. Gancho (Q): cruza entre anclajes o atrae a un mercenario desprevenido. Emboscada (F): ataca por sorpresa.', thought: true },
  ],
  campOverheard: [
    { who: 'Mercenario', text: '—¿Qué se supone que buscamos en este bosque?' },
    { who: 'Mercenario', text: '—Solo sé que le dicen “el antiguo artefacto”. El único que sabe qué es, es Marck.' },
    { who: 'Mercenario', text: '—¿Y para qué tantas armas?' },
  ],
  commanderIntro: [
    { who: 'Comandante Duarte', text: '—Así que sí había un Root Knight. Esa puerta no se abre por orden de nadie más que de Marck.' },
    E('—No importa quién seas. Defenderé mi pueblo.'),
  ],
  marckFall: [
    { who: 'Marck', text: '—¿Esto es…? Así que ya estás aquí. Esperaba más de ti. Parece que solo eres un inútil al que le dieron poderes que no conoce.' },
    T('Saco el macuahuitl y me abalanzo, pero me esquiva y me empuja más profundo en el bosque. El suelo se rompe bajo nosotros y caemos por una rampa.'),
    { who: 'Guardián de la naturaleza', text: '—Tienes que detenerlo inmediatamente.' },
    T('Caemos en un templo subterráneo antiguo. Este debe ser el lugar del artefacto. Me doy la vuelta para buscar a Marck, pero no está por ningún lado.'),
    T('Debo apresurarme a buscar el artefacto antes de que lo encuentre. El traje me guiará por el laberinto.'),
  ],
  marckIntro: [
    T('Llego a una sala grande con escaleras. A los lados, un río rodea la habitación. Arriba, el artefacto… y Marck a su lado.'),
    { who: 'Marck', text: '—¿Quieres saber qué es esto?' },
    T('No espero a que termine su discurso. Corro a atacarlo, pero él alza las manos y el amuleto brilla de un azul marino.'),
    { who: 'Marck', text: '—Es el amuleto del agua: controlo cualquier cuerpo de agua, su densidad y hasta su presión. Yo también soy el Avatar de una entidad.' },
    { who: 'Marck', text: '—Déjame ir y tú y tu pueblo estarán a salvo. No tengo nada en tu contra.' },
    { who: 'Guardián de la naturaleza', text: '—No le hagas caso. No te contó toda la historia. Entre todos decidimos quitarle esa fuente de poder porque la entidad del agua era un peligro.' },
    E('—Tú no tienes derecho a ponerte sobre los demás por un poco de poder. ¡Voy a detenerte!'),
  ],
  marckEnd: [
    T('Los sauces absorben el agua y a Marck le cuesta cada vez más atacar. Por fin lo golpeo con un tronco y creo una liana para quitarle el amuleto.'),
    { who: 'Marck', text: '—Eso me pertenece. No tienes derecho a quitármelo.' },
    E('—Tú no tienes derecho a ponerte sobre los demás por un poco de poder.'),
    { who: 'Guardián de la naturaleza', text: '—Vuélvelo a guardar donde estaba. Ahora estás tú para cuidarlo.' },
    T('Coloco el amuleto en su lugar. El agua del río brota y el amuleto baja por un hueco hasta perderse en lo profundo.'),
    T('Volteo para señalar a Marck, pero ya no está. Aprovechó el agua del río para escapar.'),
    { who: 'Guardián de la naturaleza', text: '—Regresa y mantén el lugar seguro. Ahora debes proteger el amuleto. Y entrena tus poderes: ganaste en parte por suerte, porque no había tanta agua.' },
    T('Al volver al pueblo, el traje se desvanece. Al día siguiente, las máquinas se han ido y la tala fue cancelada. Todos celebran.'),
    T('Pero, mientras camino hacia la entrada del templo, noto a Marck mirándome desde lejos… y, de pronto, la entrada comienza a romperse. De entre los restos emerge un intenso azul marino.'),
    { text: 'FIN de la primera aventura.' },
  ],
  escrito1: [T('“Quien guarda el bosque, guarda lo que duerme bajo la piedra. Ninguna entidad debe poseer lo que fue tomado.” — escrito de la antigua civilización.')],
  escrito2: [T('“Los amuletos elementales sostuvieron el mundo. Uno fue arrancado de las manos del agua para detener su hambre de poder.”')],
};
