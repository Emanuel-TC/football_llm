/**
 * CONFIGURACIÓN GLOBAL Y PROPIEDADES DEL SCRIPT
 */
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

