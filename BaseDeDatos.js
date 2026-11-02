/**
 * BASE DE DATOS (Google Sheets)
 * Gestiona el control de saturación de verbos y el historial de temas tratados
 */

/**
 * Obtiene los verbos que ya se usaron 3 o más veces en el mes actual
 */
function obtenerVerbosProhibidos() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName("Verbos") || ss.getActiveSheet();
    const datos = sheet.getDataRange().getValues();
    const mesActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");
    
    let prohibidos = [];
    
    // Empezamos en 1 para saltar los encabezados
    for (let i = 1; i < datos.length; i++) {
      let mesFila = datos[i][0];
      if (!mesFila) continue;
      
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
  } catch (e) {
    Logger.log("⚠️ Error al consultar verbos prohibidos: " + e);
    return [];
  }
}

/**
 * Registra los verbos usados en la lección de hoy (Optimizado en lote)
 */
function registrarVerbosUsados(verbosUsados) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName("Verbos") || ss.getActiveSheet();
    const mesActual = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/yyyy");
    
    const verbosUnicos = [...new Set(verbosUsados)];
    if (verbosUnicos.length === 0) return;

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
          
          datos[i][2] = nuevoConteo;
          sheet.getRange(i + 1, 3).setValue(nuevoConteo);
          encontrado = true;
          break;
        }
      }
      
      if (!encontrado) {
        nuevasFilas.push(["'" + mesActual, verboLimpio, 1]);
        datos.push([mesActual, verboLimpio, 1]);
      }
    });

    if (nuevasFilas.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, nuevasFilas.length, 3).setValues(nuevasFilas);
    }
  } catch (e) {
    Logger.log("⚠️ Error al registrar verbos usados: " + e);
  }
}

/**
 * Obtiene los últimos temas/futbolistas tratados para evitar repeticiones
 */
function obtenerTemasRecientes() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName("Historial_Temas");
    if (!sheet) return [];
    
    const datos = sheet.getDataRange().getValues();
    if (datos.length <= 1) return [];
    
    // Obtener los últimos 15 registros (saltando fila de encabezado)
    const ultimos = datos.slice(1).slice(-15);
    return ultimos.map(fila => (fila[1] || "").toString().trim()).filter(Boolean);
  } catch (e) {
    Logger.log("⚠️ No se pudo leer el historial de temas: " + e);
    return [];
  }
}

/**
 * Registra el tema y titular tratado en la lección de hoy
 */
function registrarTemaUsado(tema, titular) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName("Historial_Temas");
    if (!sheet) {
      sheet = ss.insertSheet("Historial_Temas");
      sheet.appendRow(["Fecha", "Tema / Protagonista Principal", "Titular Lección"]);
      sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
    }
    
    const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
    sheet.appendRow([fechaHoy, tema, titular || ""]);
  } catch (e) {
    Logger.log("⚠️ No se pudo registrar el tema en la hoja: " + e);
  }
}

