/**
 * AGENTE 4 & EXPORTACIÓN: Validador con Groq y envío por correo con PDF
 */

function generarValidadorGroq(textoLeccion, solucionHuecos = []) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const guiaSolucion = (Array.isArray(solucionHuecos) && solucionHuecos.length === 5)
    ? `\nSOLUCIÓN OFICIAL VERIFICADA PARA LA SECCIÓN 2 (Úsalas en este orden exacto):\n- Hueco 1: ${solucionHuecos[0]}\n- Hueco 2: ${solucionHuecos[1]}\n- Hueco 3: ${solucionHuecos[2]}\n- Hueco 4: ${solucionHuecos[3]}\n- Hueco 5: ${solucionHuecos[4]}\n`
    : "";

  const prompt = `
  Eres un asistente educativo de élite y profesor de inglés. Acabo de generar este ejercicio de inglés A1 para mi hermano de 13 años. 
  
  Tu tarea es generar la hoja de respuestas oficiales y explicadas para las secciones 2, 3 y 5.
  ${guiaSolucion}
  REGLAS CRÍTICAS PARA LA SECCIÓN 2 (READ & FILL IN THE BLANKS):
  1. El Word Bank tiene exactamente 5 palabras distintas (3 verbos, 1 adjetivo, 1 sustantivo).
  2. El texto narrativo contiene exactamente 5 huecos numerados del 1 al 5: [ ____________ ].
  3. CADA UNA DE LAS 5 PALABRAS DEL WORD BANK SE DEBE USAR EXACTAMENTE UNA VEZ.
  4. ESTÁ TOTALMENTE PROHIBIDO REPETIR UNA PALABRA en dos huecos diferentes. Las 5 respuestas de la sección 2 DEBEN ser las 5 palabras distintas del Word Bank.
  5. Asigna cada una de las 5 palabras a su hueco correspondiente en orden de aparición (del 1 al 5).
  
  Para cada respuesta, agrega una explicación súper corta (1 o 2 líneas máximo) en español mexicano, con un tono amable, claro y motivador, para copiar y pegarle esa explicación por WhatsApp si se equivoca.
  
  TEXTO DEL EJERCICIO:
  ${textoLeccion}
  
  FORMATO DE SALIDA ESTRICTO (Usa emojis):
  ✅ RESPUESTAS SECCIÓN 2 (5 palabras distintas del Word Bank, sin repetir):
  - 1. [Palabra exacta]: [Breve explicación de por qué encaja ahí según la gramática/sentido]
  - 2. [Palabra exacta]: [Breve explicación]
  - 3. [Palabra exacta]: [Breve explicación]
  - 4. [Palabra exacta]: [Breve explicación]
  - 5. [Palabra exacta]: [Breve explicación]
  
  ✅ RESPUESTAS SECCIÓN 3:
  (Resuelve exactamente las 5 oraciones del ejercicio numeradas del 1 al 5)
  - 1. [Opción correcta]: [Breve explicación de la regla gramatical A1]
  - 2. [Opción correcta]: [Breve explicación]
  - 3. [Opción correcta]: [Breve explicación]
  - 4. [Opción correcta]: [Breve explicación]
  - 5. [Opción correcta]: [Breve explicación]
  
  ✅ RESPUESTAS SECCIÓN 5:
  - 1. [Respuesta correcta y analítica basada en el texto]
  - 2. [Respuesta correcta y analítica basada en el texto]
  `;
  
  const payload = {
    model: "openai/gpt-oss-20b", 
    messages: [
      { role: "system", content: "Eres un útil asistente de profesores estricto y preciso con las hojas de respuestas." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
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

function enviarPdfPorCorreo(textoLeccion, fechaHoy, textoValidador) {
  const correoDestino = CONFIG.CORREO_DESTINO;
  Logger.log("Creando documento temporal para aislar el PDF...");
  
  const tempDoc = DocumentApp.create(`Leccion_Madrid_${fechaHoy}`);
  const tempFileId = tempDoc.getId();
  
  try {
    const body = tempDoc.getBody();
    formatearTextoEnBody(body, textoLeccion, `Noticia ${fechaHoy}`);
    tempDoc.saveAndClose();
    
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
    try {
      DriveApp.getFileById(tempFileId).setTrashed(true);
      Logger.log("Documento fantasma eliminado. ¡Operación limpia!");
    } catch (eLimpieza) {
      Logger.log("Aviso: No se pudo enviar el documento temporal a la papelera: " + eLimpieza);
    }
  }
}
