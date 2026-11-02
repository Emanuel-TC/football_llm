/**
 * AGENTE 2: Generador pedagógico con Fallback Automático (Gemini -> OpenRouter)
 */
function generarEjercicioConFallback(noticias, verbosProhibidos, temaGramatical, temasRecientes = [], enfoqueUsado = "") {
  const listaVerbosProhibidos = verbosProhibidos.length > 0 ? verbosProhibidos.join(", ") : "Ninguno por ahora";
  const listaTemasProhibidos = temasRecientes.length > 0 ? temasRecientes.join(", ") : "Ninguno por ahora";

  const contextoNoticias = (Array.isArray(noticias) && noticias.length > 0)
    ? noticias.map(n => `- Titular: ${n.title || "Noticia"}\n  Detalle: ${n.content || ""}`).join("\n\n")
    : `Tema central sugerido: ${enfoqueUsado || "Fútbol formativo y valores"}`;

  const promptCrudo = `
CONTEXTO DE NOTICIAS REALES:
${contextoNoticias}

🚫 REGLAS DE VOCABULARIO, TEMAS Y FORMATO (¡CRÍTICO!):
1. ESTÁ TOTALMENTE PROHIBIDO usar estos verbos en el texto: ${listaVerbosProhibidos}. Usa sinónimos.
2. ESTÁ TOTALMENTE PROHIBIDO repetir estos temas, futbolistas o historias ya tratados recientemente: ${listaTemasProhibidos}. Si la noticia recibida trata sobre alguno de ellos, debes enfocar el ejercicio en OTRO futbolista, equipo o aspecto diferente.
3. NO uses formato Markdown (absolutamente cero asteriscos **).

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
[TEMA_TRATADO: Nombre del futbolista o tema específico principal tratado]
[VERBOS_USADOS: verbo1, verbo2, verbo3]
`;

  // --- PLAN A: GEMINI ---
  const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  const payloadGemini = {
    systemInstruction: {
      parts: [{ 
        text: "Eres un estricto generador de datos estructurados y profesor de inglés. Tu única función es generar ejercicios siguiendo PLANTILLAS EXACTAS. Tienes prohibido usar formato Markdown (cero asteriscos **). Jamás alteras el orden de las secciones y tu nivel de inglés en el texto jamás supera el A1 básico (sujeto + verbo + predicado) Presente simple y presente continuo." 
      }]
    },
    contents: [{ parts: [{ text: promptCrudo }] }],
    generationConfig: {
      temperature: 0.15,
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
    
    // --- PLAN B: OPENROUTER ---
    const urlOpenRouter = 'https://openrouter.ai/api/v1/chat/completions';
    
    const payloadOpenRouter = {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un analista táctico y profesor de inglés." },
        { role: "user", content: promptCrudo }
      ],
      temperature: 0.2
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

