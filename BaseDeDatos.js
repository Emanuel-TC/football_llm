/**
 * BASE DE DATOS (Google Sheets)
 * Gestiona el control de saturación de verbos (máx 4 usos para siempre)
 * y el historial de temas tratados para evitar repeticiones.
 */

/**
 * Obtiene los verbos que ya alcanzaron el límite de 4 repeticiones históricas (sin importar el mes)
 */
function obtenerVerbosProhibidos() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName("Verbos") || ss.getActiveSheet();
    
    // Consolidar automáticamente si existen duplicados históricos por mes
    consolidarHojaVerbos(sheet);

    const datos = sheet.getDataRange().getValues();
    if (datos.length <= 1) return [];

    let prohibidos = [];

    // Empezamos en 1 para saltar los encabezados
    for (let i = 1; i < datos.length; i++) {
      let verbo = (datos[i][1] || "").toString().toLowerCase().trim();
      let conteo = parseInt(datos[i][2]) || 0;

      // REGLA: 4 repeticiones para siempre, no más, sin importar el mes
      if (verbo && conteo >= 4) {
        prohibidos.push(verbo);
      }
    }

    Logger.log(`🗄️ Verbos prohibidos actuales (>= 4 usos para siempre): ${prohibidos.length > 0 ? prohibidos.join(", ") : "Ninguno"}`);
    return prohibidos;
  } catch (e) {
    Logger.log("⚠️ Error al consultar verbos prohibidos: " + e);
    return [];
  }
}

/**
 * Registra los verbos usados en la lección.
 * Busca el verbo en toda la hoja (sin importar el mes) y actualiza su conteo acumulado.
 */
function registrarVerbosUsados(verbosUsados) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName("Verbos") || ss.getActiveSheet();
    const fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

    const verbosUnicos = [...new Set(verbosUsados)];
    if (verbosUnicos.length === 0) return;

    const datos = sheet.getDataRange().getValues();
    const nuevasFilas = [];

    verbosUnicos.forEach(verbo => {
      let verboLimpio = verbo.trim().toLowerCase();
      if (!verboLimpio) return;

      let encontrado = false;
      for (let i = 1; i < datos.length; i++) {
        let verboEnFila = (datos[i][1] || "").toString().trim().toLowerCase();

        if (verboEnFila === verboLimpio) {
          let conteoActual = parseInt(datos[i][2]) || 0;
          let nuevoConteo = conteoActual + 1;

          datos[i][2] = nuevoConteo;
          sheet.getRange(i + 1, 3).setValue(nuevoConteo);
          sheet.getRange(i + 1, 1).setValue(fechaHoy); // Actualiza la fecha de último uso
          encontrado = true;
          break;
        }
      }

      if (!encontrado) {
        nuevasFilas.push([fechaHoy, verboLimpio, 1]);
        datos.push([fechaHoy, verboLimpio, 1]);
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
 * Consolidación automática: Si la hoja contiene filas duplicadas del mismo verbo
 * (por ejemplo creadas en distintos meses como 08/2026, 09/2026), las fusiona sumando su conteo.
 */
function consolidarHojaVerbos(sheetParam) {
  try {
    const ss = sheetParam ? null : SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = sheetParam || ss.getSheetByName("Verbos") || ss.getActiveSheet();
    const datos = sheet.getDataRange().getValues();
    if (datos.length <= 1) return;

    const mapaVerbos = new Map();
    let hayDuplicados = false;

    for (let i = 1; i < datos.length; i++) {
      let fecha = datos[i][0];
      let verbo = (datos[i][1] || "").toString().toLowerCase().trim();
      let conteo = parseInt(datos[i][2]) || 0;

      if (!verbo) continue;

      let fechaStr = (fecha instanceof Date) 
        ? Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy") 
        : (fecha || "").toString().trim();

      if (mapaVerbos.has(verbo)) {
        hayDuplicados = true;
        let reg = mapaVerbos.get(verbo);
        reg.conteo += conteo;
        if (fechaStr) reg.fecha = fechaStr;
      } else {
        mapaVerbos.set(verbo, { fecha: fechaStr, conteo: conteo });
      }
    }

    // Solo reescribir si se encontraron duplicados
    if (hayDuplicados) {
      Logger.log(`🧹 Consolidando hoja 'Verbos': fusionando filas duplicadas a ${mapaVerbos.size} verbos únicos...`);
      
      const filasConsolidadas = [];
      for (let [verbo, reg] of mapaVerbos.entries()) {
        filasConsolidadas.push([reg.fecha || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy"), verbo, reg.conteo]);
      }

      // Ordenar alfabéticamente
      filasConsolidadas.sort((a, b) => a[1].localeCompare(b[1]));

      // Limpiar datos existentes respetando encabezados
      const ultimaFila = sheet.getLastRow();
      if (ultimaFila > 1) {
        sheet.getRange(2, 1, ultimaFila - 1, 3).clearContent();
      }

      sheet.getRange(2, 1, filasConsolidadas.length, 3).setValues(filasConsolidadas);
      Logger.log("✅ Hoja 'Verbos' consolidada con éxito.");
    }
  } catch (e) {
    Logger.log("⚠️ Aviso al consolidar hoja de verbos: " + e);
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
