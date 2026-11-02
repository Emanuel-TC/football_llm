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
    
    let textoParaAuditar = cuerpoCorreo;
    const matchLeccion = cuerpoCorreo.match(/📖 TEXTO DE LA LECCIÓN[\s\S]*?(?=✅ Validador|$)/i);
    if (matchLeccion) {
      textoParaAuditar = matchLeccion[0].replace(/📖 TEXTO DE LA LECCIÓN.*?\n/i, "").trim();
    }
    
    Logger.log(`Procesando y corrigiendo lección de: ${asunto}`);
    
    let evaluacionRaw = evaluarYMaquetarConGemini(textoParaAuditar);
    let htmlLimpio = evaluacionRaw.replace(/```html/gi, "").replace(/```/g, "").trim();
    
    reporteAuditoriaHTML += `
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #dadce0;">
        <h3 style="color: #ea4335; margin-top: 0;">📝 BASE ORIGINAL: ${asunto}</h3>
        ${htmlLimpio}
      </div>
    `;
  }
  
  reporteAuditoriaHTML += `</div>`;
  
  const correoDestino = CONFIG.CORREO_DESTINO;
    
  Logger.log("📧 Enviando Canvas corregidos a tu correo...");
  MailApp.sendEmail({
    to: correoDestino,
    subject: "🎨 Lecciones Corregidas en Formato Canvas",
    htmlBody: reporteAuditoriaHTML
  });
  
  Logger.log("🎉 ¡Proceso híbrido completado!");
}

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
    generationConfig: { temperature: 0.2 }
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

