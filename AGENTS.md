# Conversaciones con prospectos

- Interpretar las intenciones, preguntas, respuestas y datos del prospecto exclusivamente con el modelo de IA y las tools disponibles.
- No añadir expresiones regulares, listas de palabras clave, detectores de frases ni heurísticas para clasificar mensajes, elegir preguntas, recomendar servicios o redactar respuestas al prospecto.
- No reescribir el texto generado por el modelo mediante reemplazos locales. Las etiquetas legibles y los códigos estructurados correctos deben provenir del modelo.
- El backend valida el esquema de salida y los argumentos de las tools, persiste los datos y aplica el control humano y las reglas operativas. Un dato no extraído por el modelo permanece pendiente; no inferirlo del texto original.
- Las validaciones técnicas de formato y las aserciones de pruebas no deben convertirse en reglas de interpretación conversacional.
