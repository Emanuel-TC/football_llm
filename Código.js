const props = PropertiesService.getScriptProperties();

const CONFIG = {
  TAVILY_API_KEY: props.getProperty("TAVILY_API_KEY"),
  GEMINI_API_KEY: props.getProperty("GEMINI_API_KEY"),
  DOC_ID: props.getProperty("DOC_ID"),
  SHEET_ID: props.getProperty("SHEET_ID"),
  GROQ_API_KEY: props.getProperty("GROQ_API_KEY"),
  OPEN_ROUTER_API_KEY: props.getProperty("OPEN_ROUTER_API_KEY"),
  CORREO_DESTINO: props.getProperty("CORREO_DESTINO") || "heberemanuelroma@gmail.com"
};

/**
 * Función principal que orquesta los agentes
 */
function generarLeccionDiariaFutbol() {
  const diaDeLaSemana = new Date().getDay();
  // 1. Guardia: Evitar procesar en días inactivos (fin de semana)
  if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
    Logger.log("⏸️ Fin de semana detectado (sábado o domingo). No hay lección programada hoy.");
    return;
  }

  Logger.log("🤖 Agente 1: Buscando noticias recientes con Tavily...");
  const noticias = buscarNoticiasFutbol();

  Logger.log("🗄️ Base de Datos: Verificando verbos saturados...");
  const verbosProhibidos = obtenerVerbosProhibidos();
  
  Logger.log("📚 Pedagogía: Definiendo el tema gramatical del día...");
  const temaGramatical = obtenerTemaGramaticalDelDia();
  
  Logger.log("🤖 Agente 2: Diseñando ejercicio A1 con Gemini...");
  let leccionCruda = generarEjercicioConFallback(noticias, verbosProhibidos, temaGramatical);
  
  // 2. Guardia: Detener ejecución si la generación de la IA falló
  if (!leccionCruda || leccionCruda.startsWith("ERROR_IA")) {
    Logger.log("❌ Cancelando proceso: Hubo un fallo en la generación de la lección con IA.");
    return;
  }

  // 3. Extraer y limpiar metadatos de forma robusta
  let verbosExtraidos = [];
  const regex = /(?:\[)?VERBOS_USADOS:\s*([^\]\n]+)(?:\])?/i;
  const match = leccionCruda.match(regex);
  
  if (match) {
    // Convertimos la cadena "play, win, score" en un array [play, win, score]
    verbosExtraidos = match[1].split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  }
  
  // Borramos siempre la sección 7 (con o sin emoji) para que no salga en el documento ni en el PDF
  leccionCruda = leccionCruda.replace(/(?:⚙️\s*)?7\.\s*METADATOS OCULTOS[\s\S]*/i, "").trim();
  
  if (verbosExtraidos.length > 0) {
    Logger.log("🗄️ Base de Datos: Actualizando uso de verbos...");
    registrarVerbosUsados(verbosExtraidos);
  }
  
  Logger.log("🤖 Agente 3: Creando Pestaña y escribiendo en el Doc...");
  const idPestana = escribirNoticiaEnDoc(leccionCruda);
  
  Logger.log("🤖 Agente 4 (Groq): Generando la hoja de respuestas...");
  const validador = generarValidadorGroq(leccionCruda);
  
  Logger.log("🤖 Agente 5: Exportando a PDF y enviando correo...");
  const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  enviarPdfPorCorreo(leccionCruda, fechaHoy, validador);
  
  Logger.log("🎉 ¡Proceso total completado con éxito!");
}


/**
 * AGENTE 1: Búsqueda de noticias recientes de fútbol
 */
function buscarNoticiasFutbol() {
  const url = 'https://api.tavily.com/search';
  
  // Rotación de temas para abarcar más que solo resultados
  const enfoques = [
    "Real Madrid latest match result, recent tactical news, or historical interesting data about Real Madrid", // 0: Domingo (Comodín)
    
    "La Liga latest news, standings or current week updates, also related with Real Madrid", // 1: Lunes
    
    "Champions League recent matches and European football news, also related with Real Madrid", // 2: Martes
    
    "World football top players and recent viral news", // 3: Miércoles
    
    "Football young rising stars, Real Madrid youth academy (La Fabrica), or training secrets of young professional players", // 4: Jueves
    
    "Inspiring football stories, soccer players living their Christian faith (like Bukayo Saka or Alisson Becker), positive values, sportsmanship, and charity work by football stars", // 5: Viernes
    
    "Fun trivia about La Liga current season or top scorers" // 6: Sábado (Comodín)
  ];
  
  const diaDeLaSemana = new Date().getDay();
  const enfoqueDelDia = enfoques[diaDeLaSemana];
  const queryDinamico = `football news: ${enfoqueDelDia}`;
  
  const payload = {
    api_key: CONFIG.TAVILY_API_KEY,
    query: queryDinamico,
    search_depth: "advanced",
    max_results: 3,
    days: 7 // 🔴 CLAVE: Solo busca información de los últimos 7 días
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    return json.results || [];
  } catch (e) {
    Logger.log("Error al consultar Tavily: " + e);
    return [];
  }
}

/**
 * AGENTE 2: Generador pedagógico con Fallback Automático (Gemini -> OpenRouter)
 */
function generarEjercicioConFallback(noticias, verbosProhibidos, temaGramatical) {
  const listaProhibida = verbosProhibidos.length > 0 ? verbosProhibidos.join(", ") : "Ninguno por ahora";
  const contextoNoticias = Array.isArray(noticias) && noticias.length > 0
    ? noticias.map(n => `- Titular: ${n.title || "Noticia"}\n  Detalle: ${n.content || ""}`).join("\n\n")
    : "Noticias recientes de fútbol y actualidad del Real Madrid.";

  const promptCrudo = `
CONTEXTO DE NOTICIAS REALES:
${contextoNoticias}

🚫 REGLAS DE VOCABULARIO Y FORMATO (¡CRÍTICO!):
1. ESTÁ TOTALMENTE PROHIBIDO usar estos verbos en el texto: ${listaProhibida}. Usa sinónimos.
2. NO uses formato Markdown (absolutamente cero asteriscos **).

Genera el contenido EXACTAMENTE con la siguiente estructura, respetando los límites de palabras:

⚽ [TÍTULO CORTO Y ÉPICO EN INGLÉS]

📦 1. WORD BANK
[INSTRUCCIÓN CRÍTICA: Escribe EXACTAMENTE 5 palabras en inglés (3 verbos en presente simple, 1 adjetivo, 1 sustantivo). DEBEN estar en una sola línea separadas por guiones. EJEMPLO EXACTO: run - pass - score - fast - ball. ¡PROHIBIDO usar listas verticales o corchetes!]

📖 2. READ & FILL IN THE BLANKS
[Escribe un texto narrativo sobre la noticia de EXACTAMENTE entre 85 y 100 palabras en inglés A1. Sustituye las 5 palabras del Word Bank con este espacio exacto: [ ____________ ]. El texto debe ser cohesivo y no debe ser corto.]

🔀 3. CHOOSE THE CORRECT WORD
[Genera 5 oraciones dando a elegir entre dos opciones gramaticales entre corchetes. 
REGLA 1: Las oraciones DEBEN estar integradas en el contexto de la noticia o del fútbol. (No uses ejemplos genéricos de la calle o restaurantes).
REGLA 2: Deben evaluar EXCLUSIVAMENTE este tema gramatical: "${temaGramatical}".]

🗣️ 4. SUPER GLOSARIO ESPAÑOL
[Haz una lista de 10 palabras usadas en el texto. 
REGLA 1: Incluye las 5 palabras del Word Bank + 5 palabras del texto.
REGLA 2: Para los verbos, usa el formato: [Verbo]: [Traducción] [Emoji]. Presente: [Verbo]. Ejemplo: [Oración A1 de ejemplo] ([Traducción]).
REGLA 3: Para otras palabras: [Palabra]: [Traducción] [Emoji].]

🧠 5. PIENSA Y RESPONDE (ESPAÑOL)
[2 preguntas analíticas de comprensión lectora en español]

💡 6. EL RETO DEL MÍSTER
[INSTRUCCIÓN CRÍTICA: Escribe UNA SOLA PREGUNTA dirigida al alumno. Ponlo en los zapatos del entrenador y pregúntale qué haría él ante la situación de la noticia. ¡ESTÁ TOTALMENTE PROHIBIDO QUE TÚ RESPONDAS LA PREGUNTA! Solo formula la pregunta y déjala abierta.]

⚙️ 7. METADATOS OCULTOS
[VERBOS_USADOS: verbo1, verbo2, verbo3]
`;

  // --- PLAN A: INTENTO CON GEMINI ---
  // Nota: Asegúrate de usar un modelo que exista en la API (ej. gemini-1.5-flash o gemini-1.5-pro)
  const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  const payloadGemini = {
    systemInstruction: {
      parts: [{ 
        text: "Eres un estricto generador de datos estructurados y profesor de inglés. Tu única función es generar ejercicios siguiendo PLANTILLAS EXACTAS. Tienes prohibido usar formato Markdown (cero asteriscos **). Jamás alteras el orden de las secciones y tu nivel de inglés en el texto jamás supera el A1 básico (sujeto + verbo + predicado) Presente simple y presente continuo." 
      }]
    },
    contents: [{ parts: [{ text: promptCrudo }] }],
    generationConfig: {
      temperature: 0.15, // Cero creatividad, máxima precisión de formato
      topP: 0.8,
      topK: 40
    }
  };
  
  const optionsGemini = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payloadGemini),
    muteHttpExceptions: true
  };
  
  try {
    const resGemini = UrlFetchApp.fetch(urlGemini, optionsGemini);
    const jsonGemini = JSON.parse(resGemini.getContentText());
    
    if (jsonGemini.error) {
      throw new Error(`Código ${jsonGemini.error.code}: ${jsonGemini.error.message}`);
    }
    
    if (jsonGemini.candidates && jsonGemini.candidates.length > 0) {
      return jsonGemini.candidates[0].content.parts[0].text;
    }
    
  } catch (errorGemini) {
    Logger.log(`⚠️ Alerta Táctica: Gemini falló (${errorGemini.message}). Activando Fallback a OpenRouter...`);
    
    // --- PLAN B: FALLBACK CON OPENROUTER ---
    const urlOpenRouter = 'https://openrouter.ai/api/v1/chat/completions';
    
    const payloadOpenRouter = {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un analista táctico y profesor de inglés." },
        { role: "user", content: promptCrudo }
      ],
      temperature: 0.2 // Reducido a 0.2 para forzar al modelo a ser más estricto con el formato
    };
    
    const optionsOpenRouter = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${CONFIG.OPEN_ROUTER_API_KEY}`,
      },
      payload: JSON.stringify(payloadOpenRouter),
      muteHttpExceptions: true
    };
    
    try {
      const resOpenRouter = UrlFetchApp.fetch(urlOpenRouter, optionsOpenRouter);
      const jsonOpenRouter = JSON.parse(resOpenRouter.getContentText());
      
      if (jsonOpenRouter.error) {
         Logger.log("❌ Error fatal: OpenRouter también falló: " + JSON.stringify(jsonOpenRouter.error));
         return "ERROR_IA: Hubo un fallo masivo en las APIs de IA.";
      }
      
      Logger.log("✅ Fallback exitoso usando OpenRouter.");
      return jsonOpenRouter.choices[0].message.content;
      
    } catch (errorOpenRouter) {
      Logger.log("❌ Error crítico en conexión con OpenRouter: " + errorOpenRouter);
      return "ERROR_IA: Fallo total de conexión.";
    }
  }
}


/**
 * AGENTE 3: Conector que crea una nueva pestaña en Google Docs
 */
/**
 * Función auxiliar para formatear la lección en cualquier Body de Google Docs
 */
function formatearTextoEnBody(body, contenidoTexto, fechaTitulo) {
  if (fechaTitulo) {
    let pTitle = body.appendParagraph(`📅 ${fechaTitulo}`);
    pTitle.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    pTitle.setForegroundColor("#1a73e8");
    pTitle.setBold(true);
  }

  const lineas = contenidoTexto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    let linea = lineas[i].trim();
    
    // Mantener saltos de línea vacíos
    if (!linea && i !== lineas.length - 1) {
      body.appendParagraph("");
      continue;
    }
    
    let lineaLimpia = linea.replace(/\*\*/g, ""); 
    let p = body.appendParagraph(lineaLimpia);
    
    // Si la línea tiene un emoji de sección, la destacamos en negrita y Heading 3
    if (linea.startsWith("⚽") || linea.startsWith("📦") || linea.startsWith("📖") || 
        linea.startsWith("🔀") || linea.startsWith("🗣️") || linea.startsWith("🧠") || 
        linea.startsWith("💡")) {
      p.setBold(true);
      p.setHeading(DocumentApp.ParagraphHeading.HEADING3);
    } else {
      p.setBold(false);
      p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    }
  }

  // Eliminar el párrafo vacío inicial que Docs crea por defecto si hay más elementos
  const parrafos = body.getParagraphs();
  if (parrafos.length > 1 && parrafos[0].getText().trim() === "") {
    parrafos[0].removeFromParent();
  }
}

/**
 * AGENTE 3: Conector que crea una nueva pestaña en Google Docs
 */
function escribirNoticiaEnDoc(contenidoTexto) {
  const docId = CONFIG.DOC_ID;
  const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  const tituloNoticia = `📅 ${fechaHoy}`;
  
  // 1. Crear Pestaña Nativa vía API Avanzada primero
  const request = {
    addDocumentTab: {
      tabProperties: { title: tituloNoticia }
    }
  };
  
  const respuesta = Docs.Documents.batchUpdate({ requests: [request] }, docId);
  const idNuevaPestana = respuesta.replies[0].addDocumentTab.tabProperties.tabId;
  
  // 2. Abrir el documento para tener la versión más reciente con la pestaña
  const docActualizado = DocumentApp.openById(docId);
  const nuevaPestanaObj = docActualizado.getTab(idNuevaPestana).asDocumentTab();
  const body = nuevaPestanaObj.getBody();
  
  // 3. Procesar e insertar texto con formato unificado
  formatearTextoEnBody(body, contenidoTexto, null);
  
  // 4. Guardar cambios en el documento para persistencia inmediata
  docActualizado.saveAndClose();
  
  return idNuevaPestana;
}

function probarGeneracionDePestana() {
  const docId = (typeof CONFIG !== 'undefined' && CONFIG.DOC_ID) 
    ? CONFIG.DOC_ID 
    : '1nbuF4z1P8yIq3NZmrq0pjnFILEJmiLaWmJW6G54oPWg';
  const nombrePestana = "Prueba Texto Random";
  
  // 1. CREAR LA PESTAÑA primero usando la API Avanzada
  const request = {
    addDocumentTab: {
      tabProperties: {
        title: nombrePestana
      }
    }
  };
  
  Logger.log("Enviando petición a la API de Docs...");
  const respuesta = Docs.Documents.batchUpdate({ requests: [request] }, docId);
  
  // 2. OBTENER EL ID de la nueva pestaña
  const idNuevaPestana = respuesta.replies[0].addDocumentTab.tabProperties.tabId;
  Logger.log("Pestaña creada. ID: " + idNuevaPestana);
  
  // 3. ABRIR EL DOCUMENTO ACTUALIZADO y acceder al cuerpo
  const docActualizado = DocumentApp.openById(docId);
  const nuevaPestanaObj = docActualizado.getTab(idNuevaPestana).asDocumentTab();
  const cuerpoPestana = nuevaPestanaObj.getBody();
  
  // 4. ESCRIBIR TEXTO
  cuerpoPestana.appendParagraph("¡Éxito! Esta es una pestaña generada automáticamente vía API.");
  cuerpoPestana.appendParagraph("Texto random insertado el: " + new Date().toLocaleString());
  docActualizado.saveAndClose();
  
  Logger.log("¡Prueba superada!");
}

/**
 * AGENTE 6 (AUDITOR HÍBRIDO): Lee los correos, corrige errores y maqueta en formato Canvas
 */
function auditarLeccionesDeLaSemana() {
  Logger.log("🔍 Buscando las últimas lecciones en Gmail para la corrección híbrida...");
  
  const hilos = GmailApp.search('subject:"⚽ Lección del día para tu hermano:"', 0, 5);
  
  if (hilos.length === 0) {
    Logger.log("No se encontraron correos para auditar.");
    return;
  }
  
  let reporteAuditoriaHTML = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: auto;">
      <h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;">
        📊 REPORTE HÍBRIDO: CORRECCIONES Y CANVAS DEL MÍSTER
      </h2>
      <p>Gemini ha evaluado el trabajo del Agente 2, ha corregido los errores de nivel y formato, y ha maquetado las versiones definitivas listas para usarse.</p>
      <br>
  `;
  
  for (let i = 0; i < hilos.length; i++) {
    let mensajes = hilos[i].getMessages();
    let ultimoMensaje = mensajes[mensajes.length - 1];
    
    let asunto = ultimoMensaje.getSubject();
    let cuerpoCorreo = ultimoMensaje.getPlainBody(); 
    
    // Extraer limpiamente el bloque de la lección del correo si está delimitado
    let textoParaAuditar = cuerpoCorreo;
    const matchLeccion = cuerpoCorreo.match(/📖 TEXTO DE LA LECCIÓN[\s\S]*?(?=✅ Validador|$)/i);
    if (matchLeccion) {
      textoParaAuditar = matchLeccion[0].replace(/📖 TEXTO DE LA LECCIÓN.*?\n/i, "").trim();
    }
    
    Logger.log(`Procesando y corrigiendo lección de: ${asunto}`);
    
    let evaluacionRaw = evaluarYMaquetarConGemini(textoParaAuditar);
    // Limpiamos los bloques de código markdown por si Gemini los incluye
    let htmlLimpio = evaluacionRaw.replace(/```html/gi, "").replace(/```/g, "").trim();
    
    reporteAuditoriaHTML += `
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #dadce0;">
        <h3 style="color: #ea4335; margin-top: 0;">📝 BASE ORIGINAL: ${asunto}</h3>
        ${htmlLimpio}
      </div>
    `;
  }
  
  reporteAuditoriaHTML += `</div>`;
  
  const correoDestino = (typeof CONFIG !== 'undefined' && CONFIG.CORREO_DESTINO) 
    ? CONFIG.CORREO_DESTINO 
    : "heberemanuelroma@gmail.com";
    
  Logger.log("📧 Enviando Canvas corregidos a tu correo...");
  MailApp.sendEmail({
    to: correoDestino,
    subject: "🎨 Lecciones Corregidas en Formato Canvas",
    htmlBody: reporteAuditoriaHTML
  });
  
  Logger.log("🎉 ¡Proceso híbrido completado!");
}

/**
 * Función auxiliar: Gemini actúa como corrector estricto y maquetador HTML
 */
function evaluarYMaquetarConGemini(textoCorreo) {
  const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  const promptAuditor = `
  Eres el Editor Jefe de Calidad Pedagógica. Vas a recibir una lección de inglés A1 sobre fútbol generada por un sistema básico. A veces, el sistema base comete errores (sube el nivel a A2/B1, inventa palabras en el Word Bank que no encajan gramaticalmente en los huecos, o rompe el formato de las reglas originales).

  TU MISIÓN:
  1. AUDITAR: Lee el texto original y detecta cualquier desviación de estas REGLAS ESTRICTAS:
     - Nivel de inglés debe ser puramente A1 (sujeto + verbo + predicado, máximo 8 palabras por oración).
     - El Word Bank DEBE encajar perfectamente en los huecos del texto.
     - El Glosario debe incluir ejemplos en inglés con su traducción.
     - El Reto del Míster debe ser una sola pregunta abierta dirigida al alumno (tienes prohibido responderla tú mismo).
  2. REESCRIBIR: Arregla y mejora la lección completa para que sea un A1 perfecto, cohesivo y divertido.
  3. MAQUETAR: Convierte la lección corregida a un formato "Canvas" utilizando una tabla HTML limpia y moderna.

  TEXTO ORIGINAL DEL SISTEMA BASE:
  """
  ${textoCorreo}
  """

  FORMATO DE SALIDA ESTRICTO (Devuelve ÚNICAMENTE código HTML, sin introducciones ni comillas markdown):
  
  <h4 style="color: #34a853;">✅ DIAGNÓSTICO Y CORRECCIÓN:</h4>
  <p><strong>Errores encontrados:</strong> [Describe brevemente en 2 líneas qué falló en el texto original].</p>
  <p><strong>Solución aplicada:</strong> [Describe cómo lo arreglaste].</p>
  
  <h4 style="color: #1a73e8; margin-top: 20px;">🎨 CANVAS DEFINITIVO:</h4>
  <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 2px solid #bdc1c6; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="padding: 15px; border: 1px solid #bdc1c6; vertical-align: top; width: 50%;">
        <strong>📦 1. WORD BANK</strong><br>
        [Inserta aquí los 5 conceptos separados por guiones]
      </td>
      <td style="padding: 15px; border: 1px solid #bdc1c6; vertical-align: top; width: 50%; background-color: #f1f3f4;">
        <strong>📖 2. READ & FILL IN THE BLANKS</strong><br>
        [Inserta aquí el texto corregido con los espacios en blanco]
      </td>
    </tr>
    <tr>
      <td style="padding: 15px; border: 1px solid #bdc1c6; vertical-align: top;">
        <strong>🔀 3. CHOOSE THE CORRECT WORD</strong><br>
        [Inserta aquí las 5 oraciones corregidas]
      </td>
      <td style="padding: 15px; border: 1px solid #bdc1c6; vertical-align: top;">
        <strong>🗣️ 4. SUPER GLOSARIO ESPAÑOL</strong><br>
        [Inserta aquí el glosario corregido usando etiquetas <br> para separar cada línea]
      </td>
    </tr>
    <tr>
      <td style="padding: 15px; border: 1px solid #bdc1c6; vertical-align: top; background-color: #e8f0fe;" colspan="2">
        <strong>🧠 5. PIENSA Y RESPONDE (ESPAÑOL)</strong><br>
        [Inserta las 2 preguntas]<br><br>
        <strong>💡 6. EL RETO DEL MÍSTER</strong><br>
        [Inserta la pregunta estratégica corregida]
      </td>
    </tr>
  </table>
  `;
  
  const payload = {
    contents: [{ parts: [{ text: promptAuditor }] }],
    generationConfig: { temperature: 0.2 } // Ligera creatividad permitida solo para arreglar el inglés roto
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(urlGemini, options);
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates.length > 0) {
      return json.candidates[0].content.parts[0].text;
    }
    return "<p>⚠️ No se pudo evaluar este correo.</p>";
  } catch (e) {
    return "<p>⚠️ Error al conectar con la API de evaluación.</p>";
  }
}

/**
 * EXTRA 1: Exporta una pestaña específica a PDF y la envía por correo
 */
function enviarPdfPorCorreo(textoLeccion, fechaHoy, textoValidador) {
  const correoDestino = (typeof CONFIG !== 'undefined' && CONFIG.CORREO_DESTINO) 
    ? CONFIG.CORREO_DESTINO 
    : "heberemanuelroma@gmail.com";
  Logger.log("Creando documento temporal para aislar el PDF...");
  
  // 1. Crear un Documento Temporal en blanco
  const tempDoc = DocumentApp.create(`Leccion_Madrid_${fechaHoy}`);
  const tempFileId = tempDoc.getId();
  
  try {
    const body = tempDoc.getBody();
    
    // 2. Formatear el Documento Temporal con la función compartida
    formatearTextoEnBody(body, textoLeccion, `Noticia ${fechaHoy}`);
    
    // 3. Guardar cambios obligatoriamente antes de exportar
    tempDoc.saveAndClose();
    
    // 4. Convertir ese documento exacto a PDF
    const pdfBlob = tempDoc.getAs('application/pdf').setName(`Leccion_Madrid_${fechaHoy}.pdf`);
    
    Logger.log("Enviando correo con el PDF aislado...");
    MailApp.sendEmail({
      to: correoDestino,
      subject: `⚽ Lección del día para tu hermano: ${fechaHoy}`,
      htmlBody: `
        <h3>¡Tu nueva lección está lista!</h3>
        <p>Adjunto encontrarás el PDF limpio de la lección de hoy.</p>
        <hr>
        <div style="background-color: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 15px 0;">
          <h4 style="margin-top: 0; color: #1a73e8;">📖 TEXTO DE LA LECCIÓN (Lectura y Auditoría):</h4>
          <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; color: #202124; font-size: 14px; margin: 0;">${textoLeccion}</pre>
        </div>
        <hr>
        <h3>✅ Validador para el Míster (Respuestas)</h3>
        <p>Aquí tienes las respuestas para que le corrijas por WhatsApp:</p>
        <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; color: #1b5e20; background: #e8f5e9; padding: 12px; border-radius: 6px;">${textoValidador}</pre>
      `,
      attachments: [pdfBlob]
    });
  } finally {
    // 5. Garantizar eliminación del documento temporal incluso ante fallos de envío
    try {
      DriveApp.getFileById(tempFileId).setTrashed(true);
      Logger.log("Documento fantasma eliminado. ¡Operación limpia!");
    } catch (eLimpieza) {
      Logger.log("Aviso: No se pudo enviar el documento temporal a la papelera: " + eLimpieza);
    }
  }
}

/**
 * EXTRA 2: Validador de respuestas usando Groq
 */
function generarValidadorGroq(textoLeccion) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  
  const prompt = `
  Eres un asistente educativo. Acabo de generar este ejercicio de inglés A1 para mi hermano de 13 años. 
  
  Tu tarea es leer el ejercicio y darme ÚNICAMENTE la hoja de respuestas para las secciones 2, 3 y 5. 
  
  Para cada respuesta, agrega una explicación súper corta (1 o 2 líneas máximo) en español mexicano, con un tono amable, para que yo pueda copiar y pegarle esa explicación por WhatsApp si se equivoca. 
  
  TEXTO DEL EJERCICIO:
  ${textoLeccion}
  
  FORMATO DE SALIDA (Usa emojis):
  ✅ RESPUESTAS SECCIÓN 2:
  - [Palabra 1]: [Breve explicación de por qué encaja ahí]
  (Resuelve las 5 palabras del texto)
  
  ✅ RESPUESTAS SECCIÓN 3:
  (Resuelve exactamente las 5 oraciones del ejercicio numeradas del 1 al 5)
  - 1. [Opción correcta]: [Breve explicación de la regla gramatical A1]
  - 2. [Opción correcta]: [Breve explicación]
  - 3. [Opción correcta]: [Breve explicación]
  - 4. [Opción correcta]: [Breve explicación]
  - 5. [Opción correcta]: [Breve explicación]
  
  ✅ RESPUESTAS SECCIÓN 5:
  - 1. [Respuesta correcta basada en el texto]
  - 2. [Respuesta correcta basada en el texto]
  `;
  
  const payload = {
    model: "openai/gpt-oss-20b", 
    messages: [
      { role: "system", content: "Eres un útil asistente de profesores." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3 // Temperatura baja para que sea analítico y no invente
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const respuesta = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(respuesta.getContentText());
    return json.choices[0].message.content;
  } catch (e) {
    Logger.log("Error en Groq: " + e);
    return "No se pudo generar el validador hoy.";
  }
}


/**
 * BASE DE DATOS: Obtiene los verbos que ya se usaron 3 veces en el mes actual
 */
function obtenerVerbosProhibidos() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName("Verbos") || ss.getActiveSheet();
  const datos = sheet.getDataRange().getValues();
  const mesActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");
  
  let prohibidos = [];
  
  // Empezamos en 1 para saltar los encabezados
  for (let i = 1; i < datos.length; i++) {
    let mesFila = datos[i][0];
    if (!mesFila) continue;
    
    // Extraer correctamente el mes sin importar cómo lo formateó Google Sheets
    let mesFilaStr = (mesFila instanceof Date) 
      ? Utilities.formatDate(mesFila, Session.getScriptTimeZone(), "MM/yyyy") 
      : mesFila.toString().trim();
      
    let verbo = (datos[i][1] || "").toString().toLowerCase().trim();
    let conteo = parseInt(datos[i][2]) || 0;
    
    if (mesFilaStr === mesActual && conteo >= 3 && verbo) {
      prohibidos.push(verbo);
    }
  }
  return prohibidos;
}

/**
 * BASE DE DATOS: Registra los verbos usados en la lección de hoy (Optimizado en lote)
 */
function registrarVerbosUsados(verbosUsados) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName("Verbos") || ss.getActiveSheet();
  const mesActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");
  
  const verbosUnicos = [...new Set(verbosUsados)];
  if (verbosUnicos.length === 0) return;

  // 1. Una sola lectura de toda la hoja para eliminar cuellos de botella
  const datos = sheet.getDataRange().getValues();
  const nuevasFilas = [];

  verbosUnicos.forEach(verbo => {
    let verboLimpio = verbo.trim().toLowerCase();
    if (!verboLimpio) return;
    
    let encontrado = false;
    for (let i = 1; i < datos.length; i++) {
      let mesFila = datos[i][0];
      let mesFilaStr = (mesFila instanceof Date) 
        ? Utilities.formatDate(mesFila, Session.getScriptTimeZone(), "MM/yyyy") 
        : (mesFila || "").toString().trim();
        
      let verboEnFila = (datos[i][1] || "").toString().trim().toLowerCase();
      
      if (mesFilaStr === mesActual && verboEnFila === verboLimpio) {
        let conteoActual = parseInt(datos[i][2]) || 0;
        let nuevoConteo = conteoActual + 1;
        
        datos[i][2] = nuevoConteo; // Actualizamos la memoria local
        sheet.getRange(i + 1, 3).setValue(nuevoConteo);
        encontrado = true;
        break;
      }
    }
    
    // Si el verbo no existía en este mes, lo preparamos para inserción en lote
    if (!encontrado) {
      nuevasFilas.push(["'" + mesActual, verboLimpio, 1]);
      datos.push([mesActual, verboLimpio, 1]);
    }
  });

  // 2. Inserción en lote (batch) de nuevas filas
  if (nuevasFilas.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevasFilas.length, 3).setValues(nuevasFilas);
  }
}

/**
 * PEDAGOGÍA: Define el tema gramatical A1 a evaluar según el día de la semana
 */
function obtenerTemaGramaticalDelDia() {
  const temas = [
    "Día inactivo (Domingo)", // 0: No se ejecuta
    
    "GRAMÁTICA ESENCIAL 1 Y VOCABULARIO: Verbo To Be (am, is, are), Pronombres personales/posesivos (I, you, he, she, my, your, his, her) e Información personal (números 0-100, países, abecedario).", // 1: Lunes
    
    "GRAMÁTICA ESENCIAL 2 Y RUTINAS: Presente Simple (rutinas, gustos), Verbo Can (habilidades) y Vocabulario diario (días de la semana, meses, estaciones, decir la hora, adjetivos comunes como big, fast).", // 2: Martes
    
    "UBICACIÓN, DIRECCIÓN Y DEMOSTRATIVOS: Preposiciones de ubicación (under, next to, between, in front of, behind), Direcciones (left, right, straight ahead) y Demostrativos (this, that, these, those).", // 3: Miércoles
    
    "PREGUNTAS Y ENTORNO: Preguntas básicas (What, who, where, when, why, how), Artículos y cantidad (a, an, the, some, any) y Vocabulario del entorno (familia, profesiones, ropa, colores, comida, casa).", // 4: Jueves
    
    "HABILIDADES COMUNICATIVAS Y REPASO: Saludar, despedirse, pedir comida en restaurante, comprar un boleto, pedir que repitan (Can you repeat, please?), llenar formularios y verbos de fútbol.", // 5: Viernes
    
    "Día inactivo (Sábado)" // 6: No se ejecuta
  ];
  
  const diaDeLaSemana = new Date().getDay();
  return temas[diaDeLaSemana];
}