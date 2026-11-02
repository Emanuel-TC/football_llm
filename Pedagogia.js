/**
 * PEDAGOGÍA: Temario gramatical A1 adaptado a Lunes, Miércoles y Viernes
 */
function obtenerTemaGramaticalDelDia() {
  const diaDeLaSemana = new Date().getDay();

  // Temario estructurado para el ciclo de 3 días semanales
  switch (diaDeLaSemana) {
    case 1: // LUNES: Fundamentos, resultados del fin de semana y rutinas
      return "GRAMÁTICA ESENCIAL Y RESULTADOS: Verbo To Be (am, is, are), Pronombres personales y posesivos (I, you, he, she, my, your, his, her), Números para marcadores/edades y Presente Simple básico de hechos y rutinas (win, score, play, celebrate).";

    case 3: // MIÉRCOLES: Habilidades tácticas, preguntas y visión de campo (Champions / Estrellas)
      return "HABILIDADES Y PREGUNTAS TÁCTICAS: Verbo modal Can/Can't (habilidades futbolísticas), Preguntas Wh- básicas (What, who, where, when, how), Demostrativos (this, that, these, those) y Preposiciones de ubicación en la cancha (next to, between, in front of, behind).";

    case 5: // VIERNES: Valores, historias humanas, fe y adjetivos
      return "VALORES, ADJETIVOS Y EMOCIONES: Adjetivos calificativos de carácter y valores (humble, kind, brave, fast, strong, generous, grateful), Artículos (a, an, the, some), Expresiones de gratitud y verbos de acción positiva (help, give, share, pray, inspire).";

    default:
      return "Día inactivo";
  }
}

