/**
 * AGENTE 1: Búsqueda dinámica de noticias y crónicas de fútbol (Tavily)
 * Incluye catálogos temáticos rotativos para evitar repeticiones
 */

function buscarNoticiasFutbol(temasRecientes = []) {
  const url = 'https://api.tavily.com/search';
  const diaDeLaSemana = new Date().getDay();

  // POOL MIÉRCOLES: Estrellas mundiales, Champions League y curiosidades tácticas
  const POOL_MIERCOLES = [
    "Champions League recent matches, tactical analysis and European football news",
    "Erling Haaland and Kevin De Bruyne incredible attacking plays and stats",
    "Kylian Mbappe and Vinicius Junior speed, teamwork and goals for Real Madrid",
    "Luka Modric football longevity, passing vision and training discipline",
    "Thibaut Courtois miraculous saves and modern goalkeeper reflex training",
    "Harry Kane goalscoring masterclass and playmaking movements in Europe",
    "Lamine Yamal and Arda Guler: teenage prodigies shining in top flight football",
    "Jude Bellingham leadership, maturity and tactical intelligence on the pitch"
  ];

  // POOL VIERNES: Valores, fe cristiana, superación, caridad y Fair Play
  const POOL_VIERNES = [
    "Sadio Mane charity work in Senegal, building hospitals and schools with his football earnings",
    "Bukayo Saka speaking openly about Christian faith, reading the Bible daily and humility in sports",
    "Alisson Becker Christian testimony, baptisms, prayer and humble character in world football",
    "Marcus Rashford charity campaigns for children and free school meals in England",
    "Juan Mata Common Goal movement: soccer players donating one percent to social projects",
    "Miroslav Klose legendary fair play moments: admitting a handball and refusing an unfair penalty",
    "Casemiro childhood story: poverty, perseverance, faith and hard work to achieve his dreams",
    "David Alaba inspiring faith journey, family values and humility: Meine Kraft liegt in Jesus",
    "Son Heung-min and his father: profound respect, sportsmanship, and mental discipline",
    "Paolo Di Canio iconic sportsmanship award: stopping play when opponent goalkeeper was injured",
    "Didier Drogba calling for national peace in Ivory Coast through the power of football"
  ];

  let queryDinamico = "";
  let esDiaDeActualidad = false;

  if (diaDeLaSemana === 1) {
    // LUNES: Resumen de fin de semana, La Liga y Real Madrid
    queryDinamico = "football news: La Liga latest weekend match results, standings, Real Madrid highlights and goals";
    esDiaDeActualidad = true;
  } else if (diaDeLaSemana === 3) {
    // MIÉRCOLES: Alterna entre Champions reciente o estrellas del pool
    const subtema = seleccionarDePool(POOL_MIERCOLES, temasRecientes);
    queryDinamico = `football news: ${subtema}`;
    esDiaDeActualidad = true;
  } else if (diaDeLaSemana === 5) {
    // VIERNES: Historias de valores y fe (sin límite estricto de 7 días para encontrar crónicas ricas)
    const subtema = seleccionarDePool(POOL_VIERNES, temasRecientes);
    queryDinamico = `football story: ${subtema}`;
    esDiaDeActualidad = false;
  } else {
    queryDinamico = "football news: Real Madrid recent news and highlights";
    esDiaDeActualidad = true;
  }

  const payload = {
    api_key: CONFIG.TAVILY_API_KEY,
    query: queryDinamico,
    search_depth: "advanced",
    max_results: 3
  };

  // Solo forzar los últimos 7 días si es actualidad competitiva
  if (esDiaDeActualidad) {
    payload.days = 7;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    return {
      noticias: json.results || [],
      enfoqueUsado: queryDinamico
    };
  } catch (e) {
    Logger.log("⚠️ Error al consultar Tavily: " + e);
    return {
      noticias: [],
      enfoqueUsado: queryDinamico
    };
  }
}

/**
 * Selecciona un tema del catálogo que no coincida con los tratados recientemente
 */
function seleccionarDePool(pool, temasRecientes = []) {
  if (!temasRecientes || temasRecientes.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Filtrar los que no contengan palabras clave de los temas recientes
  const disponibles = pool.filter(tema => {
    const temaLower = tema.toLowerCase();
    return !temasRecientes.some(reciente => {
      const palabrasClave = reciente.toLowerCase().split(/\s+/).filter(p => p.length > 3);
      return palabrasClave.some(palabra => temaLower.includes(palabra));
    });
  });

  const opciones = disponibles.length > 0 ? disponibles : pool;
  return opciones[Math.floor(Math.random() * opciones.length)];
}

