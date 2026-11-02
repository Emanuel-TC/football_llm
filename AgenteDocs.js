/**
 * AGENTE 3: Conector que crea una nueva pestaña nativa en Google Docs
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
    
    if (!linea && i !== lineas.length - 1) {
      body.appendParagraph("");
      continue;
    }
    
    let lineaLimpia = linea.replace(/\*\*/g, ""); 
    let p = body.appendParagraph(lineaLimpia);
    
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

  const parrafos = body.getParagraphs();
  if (parrafos.length > 1 && parrafos[0].getText().trim() === "") {
    parrafos[0].removeFromParent();
  }
}

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
  
  // 4. Guardar cambios
  docActualizado.saveAndClose();
  
  return idNuevaPestana;
}

function probarGeneracionDePestana() {
  const docId = (typeof CONFIG !== 'undefined' && CONFIG.DOC_ID) 
    ? CONFIG.DOC_ID 
    : '1nbuF4z1P8yIq3NZmrq0pjnFILEJmiLaWmJW6G54oPWg';
  const nombrePestana = "Prueba Texto Random";
  
  const request = {
    addDocumentTab: {
      tabProperties: {
        title: nombrePestana
      }
    }
  };
  
  Logger.log("Enviando petición a la API de Docs...");
  const respuesta = Docs.Documents.batchUpdate({ requests: [request] }, docId);
  const idNuevaPestana = respuesta.replies[0].addDocumentTab.tabProperties.tabId;
  Logger.log("Pestaña creada. ID: " + idNuevaPestana);
  
  const docActualizado = DocumentApp.openById(docId);
  const nuevaPestanaObj = docActualizado.getTab(idNuevaPestana).asDocumentTab();
  const cuerpoPestana = nuevaPestanaObj.getBody();
  
  cuerpoPestana.appendParagraph("¡Éxito! Esta es una pestaña generada automáticamente vía API.");
  cuerpoPestana.appendParagraph("Texto random insertado el: " + new Date().toLocaleString());
  docActualizado.saveAndClose();
  
  Logger.log("¡Prueba superada!");
}

