/**
 * ORQUESTADOR PRINCIPAL
 * Se ejecuta automáticamente los LUNES, MIÉRCOLES y VIERNES
 */
function generarLeccionDiariaFutbol() {
  const diaDeLaSemana = new Date().getDay();

  // 1. Guardia estricta: Solo procesar Lunes (1), Miércoles (3) y Viernes (5)
  if (diaDeLaSemana !== 1 && diaDeLaSemana !== 3 && diaDeLaSemana !== 5) {
    const nombresDias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    Logger.log(`⏸️ Día inactivo detectado (${nombresDias[diaDeLaSemana]}). El sistema solo genera lecciones Lunes, Miércoles y Viernes.`);
    return;
  }

  Logger.log("🗄️ Base de Datos: Verificando historial de temas y verbos saturados...");
  const temasRecientes = obtenerTemasRecientes();
  const verbosProhibidos = obtenerVerbosProhibidos();

  Logger.log("🤖 Agente 1: Buscando contenido con Tavily (filtrando temas recientes)...");
  const busqueda = buscarNoticiasFutbol(temasRecientes);
  
  Logger.log("📚 Pedagogía: Definiendo el tema gramatical del día...");
  const temaGramatical = obtenerTemaGramaticalDelDia();
  
  Logger.log("🤖 Agente 2: Diseñando ejercicio A1 con IA...");
  let leccionCruda = generarEjercicioConFallback(
    busqueda.noticias, 
    verbosProhibidos, 
    temaGramatical, 
    temasRecientes, 
    busqueda.enfoqueUsado
  );
  
  // 2. Guardia: Detener ejecución si la generación falló
  if (!leccionCruda || leccionCruda.startsWith("ERROR_IA")) {
    Logger.log("❌ Cancelando proceso: Hubo un fallo en la generación de la lección con IA.");
    return;
  }

  // 3. Extraer metadatos (Verbos, Tema y Solución de Huecos)
  let verbosExtraidos = [];
  const regexVerbos = /(?:\[)?VERBOS_USADOS:\s*([^\]\n]+)(?:\])?/i;
  const matchVerbos = leccionCruda.match(regexVerbos);
  if (matchVerbos) {
    verbosExtraidos = matchVerbos[1].split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  }

  let temaExtraido = "";
  const regexTema = /(?:\[)?TEMA_TRATADO:\s*([^\]\n]+)(?:\])?/i;
  const matchTema = leccionCruda.match(regexTema);
  if (matchTema) {
    temaExtraido = matchTema[1].trim();
  }

  // Extraer solución exacta de los huecos para el validador
  let solucionHuecos = [];
  const regexSolucion = /(?:\[)?SOLUCION_HUECOS:\s*([^\]\n]+)(?:\])?/i;
  const matchSolucion = leccionCruda.match(regexSolucion);
  if (matchSolucion) {
    solucionHuecos = matchSolucion[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }

  // Extraer el titular en inglés para registro en Sheets
  let titularExtraido = "";
  const matchTitular = leccionCruda.match(/⚽\s*(.+)/);
  if (matchTitular) {
    titularExtraido = matchTitular[1].replace(/\[|\]/g, "").trim();
  }

  // Limpiar la sección 7 de metadatos antes de exportar a Docs y PDF
  leccionCruda = leccionCruda.replace(/(?:⚙️\s*)?7\.\s*METADATOS OCULTOS[\s\S]*/i, "").trim();
  
  // 4. Guardar datos en Google Sheets
  if (verbosExtraidos.length > 0) {
    // Filtrar para no seguir incrementando verbos que ya estaban prohibidos
    const verbosValidos = verbosExtraidos.filter(v => {
      if (verbosProhibidos.includes(v)) {
        Logger.log(`⚠️ Advertencia: La IA intentó usar el verbo ya prohibido '${v}'. Se mantiene bloqueado.`);
        return false;
      }
      return true;
    });

    if (verbosValidos.length > 0) {
      Logger.log("🗄️ Base de Datos: Actualizando uso de verbos en Sheets...");
      registrarVerbosUsados(verbosValidos);
    }
  }

  if (temaExtraido || titularExtraido) {
    Logger.log(`🗄️ Base de Datos: Registrando tema '${temaExtraido}' en 'Historial_Temas'...`);
    registrarTemaUsado(temaExtraido || "Fútbol", titularExtraido);
  }
  
  // 5. Agente 3: Escribir en Google Docs (Pestaña nueva)
  Logger.log("🤖 Agente 3: Creando pestaña y escribiendo en Google Docs...");
  const idPestana = escribirNoticiaEnDoc(leccionCruda);
  
  // 6. Agente 4: Generar respuestas con Groq (con la solución verificada)
  Logger.log("🤖 Agente 4 (Groq): Generando la hoja de respuestas...");
  const validador = generarValidadorGroq(leccionCruda, solucionHuecos);
  
  // 7. Agente 5: Exportar a PDF y enviar correo
  Logger.log("🤖 Agente 5: Exportando a PDF y enviando correo...");
  const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  enviarPdfPorCorreo(leccionCruda, fechaHoy, validador);
  
  Logger.log("🎉 ¡Proceso total completado con éxito!");
}
