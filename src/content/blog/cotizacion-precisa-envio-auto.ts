/**
 * Blog article #4-ES (2026-07-22).
 * Spanish sibling of accurate-car-shipping-quote.ts (not a literal
 * translation — same structure, copy adapted for the ES reader).
 * Cluster: planning-shipment.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "cotizacion-precisa-envio-auto",
  language: "es",
  title: "Cómo obtener una cotización precisa para enviar tu auto (9 consejos + errores que cuestan dinero)",
  subtitle:
    "La mayoría de las cotizaciones están hechas para ganar tu reserva, no para predecir tu precio final. Aquí te explicamos qué información dar, qué preguntas hacer y cómo detectar los números que nunca fueron reales.",
  metaDescription:
    "Nueve consejos prácticos para obtener una cotización precisa de transporte de autos: qué detalles mueven el precio, cómo comparar cotizaciones, los errores que cuestan dinero y cuándo conviene manejar en vez de enviar.",
  publishedAt: "2026-07-22",
  updatedAt: "2026-07-22",
  author: "Auto Line Logistics",
  readMinutes: 9,
  category: "Guía del comprador",
  cluster: "planning-shipment",
  hubLink: { label: "Guía anti-estafa", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "Una cotización de transporte de autos es una predicción. Alguien te está diciendo cuánto va a aceptar un camionero con el que nunca ha hablado, en una ruta cuyos precios cambian cada semana, por un vehículo que confía en que tú describas correctamente. Hecha con honestidad, esa predicción puede ser muy exacta. Hecha como la hace buena parte de esta industria, la cotización es un número de marketing: lo bajan para ganar tu reserva y lo ajustan hacia arriba cuando llega la realidad.",
        "La buena noticia: la precisión es sobre todo un proceso, y la mitad de ese proceso lo controlas tú. La información que das, las preguntas que haces y la forma en que lees las respuestas determinan si el número con el que planeas es el número que pagas.",
        "Aquí está el proceso, contado desde adentro de la máquina de precios.",
      ],
    },

    { kind: "h2", text: "Por qué varían tanto las cotizaciones para la misma ruta" },
    {
      kind: "pp",
      texts: [
        "Pídele a cinco compañías que envíen el mismo sedán de Los Ángeles a Dallas y puedes recibir cinco números con $400 de diferencia. Esa dispersión tiene dos causas honestas y una deshonesta.",
        "Causa honesta uno: el momento. Los precios de los transportistas se mueven con el combustible, la temporada y cuántos camiones están en esa ruta esta semana. Una cotización tomada de datos de mercado en vivo y otra tomada de una tabla de tarifas del trimestre pasado van a diferir legítimamente.",
        "Causa honesta dos: lo que incluye. Puerta a puerta versus terminal, abierto versus cerrado, un seguro verificado versus \"el transportista seguramente tiene cobertura\" — eso cambia el costo del servicio, no solo el precio.",
        "La causa deshonesta: algunos brokers cotizan un número que ningún transportista va a aceptar, cobran tu depósito y renegocian cuando llega la semana de recogida. Si una cotización está 20% debajo de las demás, no es una ganga: es carnada. La cotización más barata suele terminar siendo la más cara.",
      ],
    },

    { kind: "h2", text: "Los 9 consejos para una cotización precisa" },

    { kind: "h3", text: "1. Usa códigos postales exactos, no nombres de ciudades" },
    {
      kind: "p",
      text: "\"Los Ángeles a Dallas\" abarca cien millas de geografía real de recogida. Un código postal en plena zona urbana cuesta distinto que uno en un camino rural a treinta minutos de la autopista. Toda cotización precisa empieza con dos códigos postales de cinco dígitos. Si un formulario solo pide ciudades, está estimando a grandes rasgos a propósito.",
    },

    { kind: "h3", text: "2. Describe el vehículo con exactitud — incluyendo lo incómodo" },
    {
      kind: "p",
      text: "Año, marca, modelo y los extras honestos: suspensión levantada, parrilla de techo, llantas grandes, una cajuela llena de cajas o un auto que no enciende. Un vehículo que no arranca necesita camión con malacate. Una camioneta levantada ocupa un espacio más alto en el remolque. Los vehículos mal descritos son la razón legítima número uno de cambios de precio en la recogida — y la excusa favorita de los brokers deshonestos. Quítales esa excusa de la mesa.",
    },

    { kind: "h3", text: "3. Sé claro con tus fechas" },
    {
      kind: "p",
      text: "La flexibilidad es un descuento. Una ventana de recogida de tres a cinco días le permite al despachador subirte a un camión que ya viene en camino; \"tiene que salir mañana\" significa pagar una prima por el que esté más cerca. Si tus fechas son fijas, dilo y acepta la prima como real. Si son flexibles, dilo también: es la palanca más barata que tienes.",
    },

    { kind: "h3", text: "4. Haz la pregunta que aclara todo: \"¿Este precio está bloqueado o es un estimado?\"" },
    {
      kind: "p",
      text: "Esta sola pregunta clasifica a la industria. Un estimado puede moverse; un precio bloqueado no. Haz que la compañía te diga cuál de los dos tienes, por escrito. Si la respuesta es evasiva — \"suele ser exacto\", \"los precios casi nunca cambian\" — tienes un estimado disfrazado de precio bloqueado.",
    },

    { kind: "h3", text: "5. Compara tres o más cotizaciones — y lee bien la que se sale del grupo" },
    {
      kind: "p",
      text: "Tres cotizaciones te muestran la forma real del mercado: un grupo compacto y quizás un valor atípico. El grupo es lo que los transportistas realmente aceptan. Un atípico alto puede ser transporte cerrado o servicio premium. Un atípico bajo, 20% o más debajo del grupo, es un número diseñado para ganar una llamada. Táchalo primero, no al final.",
    },

    { kind: "h3", text: "6. Pregunta exactamente qué incluye el número" },
    {
      kind: "p",
      text: "¿Puerta a puerta o terminal a terminal? ¿El seguro de carga del transportista está verificado, y por cuánto? ¿Incluye combustible? ¿Va a aparecer después una \"tarifa de despacho\" o \"tarifa de broker\"? Una cotización precisa es una cotización todo incluido. Cualquier cargo detallado después de comprometerte estuvo escondido a propósito.",
    },

    { kind: "h3", text: "7. Pregunta de dónde sale el precio" },
    {
      kind: "p",
      text: "\"¿Cómo calcularon este precio?\" es una pregunta justa y las respuestas revelan mucho. Datos de mercado en vivo de las plataformas donde los transportistas aceptan cargas esta semana es un tipo de respuesta. Una tabla de tarifas, un promedio nacional o el silencio es otro. Los precios calculados con datos viejos están mal en una dirección o en la otra — y nunca a tu favor por mucho tiempo.",
    },

    { kind: "h3", text: "8. Respeta la temporada y la dirección" },
    {
      kind: "p",
      text: "En enero los camiones entran llenos a Florida y regresan vacíos; la temporada de snowbirds se invierte dos veces al año. Las rutas a zonas remotas cuestan más de lo que sugiere el kilometraje; los tramos de regreso en circuitos concurridos (Texas de vuelta a California, por ejemplo) pueden salir sorprendentemente bien porque los transportistas necesitan carga para volver. Si tus fechas pueden moverse un par de semanas alrededor de un pico de temporada, el mismo envío sale más barato.",
    },

    { kind: "h3", text: "9. Nunca pagues un depósito grande por un estimado" },
    {
      kind: "p",
      text: "Un depósito debe comprarte un precio comprometido y bloqueado — no un lugar en la fila para una renegociación. Si el número todavía puede moverse, tu dinero todavía no debería haberse movido. Esta sola regla filtra a la mayoría de los peores actores de la industria.",
    },

    { kind: "h2", text: "Errores que cuestan dinero de verdad" },
    {
      kind: "checklist",
      items: [
        { label: "Reservar la más barata de cinco cotizaciones sin preguntar por qué es la más barata", tone: "warn" },
        { label: "Ocultar que el auto no enciende (el camión con malacate se entera de todos modos — en la recogida)", tone: "warn" },
        { label: "Poner tu teléfono en un sitio comparador que revende tus datos a una docena de brokers — las llamadas no paran en semanas", tone: "warn" },
        { label: "Esperar hasta tres días antes de necesitar el envío y negociar desde la desesperación", tone: "warn" },
        { label: "Tratar un número verbal como un compromiso — si no está por escrito, no existe", tone: "warn" },
        { label: "Pedir la cotización por escrito, con precio bloqueado y ventana de recogida definida", tone: "ok" },
      ],
    },

    { kind: "h2", text: "¿Enviarlo o manejarlo?" },
    {
      kind: "pp",
      texts: [
        "La comparación que más gente hace mal no es entre dos cotizaciones — es entre enviar y manejar. Quien maneja cuenta la gasolina y olvida todo lo demás: hoteles, comidas, las 2,800 millas extra de depreciación y desgaste de llantas, los días de vacaciones quemados y el riesgo de un viaje tan largo.",
        "Haz la cuenta honesta en una ruta larga y manejar suele costar casi lo mismo que enviar — antes de ponerle cualquier valor a tu tiempo. Si el viaje en sí es el plan, maneja y disfrútalo. Si es un trámite entre tú y tu mudanza, para eso exactamente existen los transportistas.",
      ],
    },

    {
      kind: "callout",
      tone: "brand",
      title: "Cómo funciona nuestra cotización",
      body: "El número que muestra nuestra calculadora sale de datos de mercado en vivo para tus códigos postales y tu vehículo exactos, en el momento en que preguntas — y ahí se bloquea. Sin depósito para verlo, sin renegociación en la semana de recogida, y con un equipo que te atiende en español. Toma unos dos minutos y no te pone en la lista de llamadas de nadie.",
    },

    {
      kind: "cta",
      title: "Obtén un precio bloqueado, todo incluido, en dos minutos",
      body: "Códigos postales exactos de entrada, precio real de mercado de salida. El número que ves es el número que pagas.",
      href: "/quote",
      label: "Cotizar ahora",
    },
  ],
  faq: [
    {
      q: "¿Cómo obtengo una cotización precisa para enviar mi auto?",
      a: "Da códigos postales exactos, describe el vehículo con honestidad (incluyendo modificaciones o si no enciende), aclara qué tan flexibles son tus fechas y pregunta si el número es un precio bloqueado o un estimado. Después compara contra al menos otras dos cotizaciones y descarta cualquiera que esté 20% o más debajo del grupo.",
    },
    {
      q: "¿Qué información necesito para cotizar el envío de un auto?",
      a: "Códigos postales de recogida y entrega, año, marca y modelo del vehículo, si enciende o no, modificaciones (suspensión, parrillas, llantas grandes), tu ventana de recogida preferida y si necesitas transporte abierto o cerrado.",
    },
    {
      q: "¿Por qué las cotizaciones de envío de autos son tan diferentes entre sí?",
      a: "Por el momento (datos de mercado en vivo versus tablas de tarifas viejas), por el alcance (puerta a puerta versus terminal, seguro verificado o no) y por honestidad. Una cotización muy por debajo de las demás suele ser carnada que se renegocia antes de la recogida.",
    },
    {
      q: "¿Es más barato manejar o enviar un auto en un viaje largo?",
      a: "Contando gasolina, hoteles, comidas, depreciación y tu tiempo, manejar una ruta larga suele quedar a unos pocos cientos de dólares del envío — y muchas veces sale más caro si tus días libres valen algo. Enviar gana en esfuerzo; manejar solo gana si quieres el viaje por carretera.",
    },
    {
      q: "¿Con cuánta anticipación debo reservar el transporte de mi auto?",
      a: "Dos a tres semanas es el punto ideal: suficiente tiempo para que el despachador te coloque en un camión que ya recorre tu ruta, sin la prima de última hora. Reservar el mismo día es posible, pero pagas por cercanía, no por eficiencia.",
    },
  ],
  related: [
    {
      slug: "por-que-las-cotizaciones-no-aguantan",
      title: "Por qué tu cotización de transporte podría no sostenerse (y qué revisar)",
      blurb: "Tres razones por las que suben las cotizaciones después de reservar + cuatro preguntas para cualquier broker.",
    },
    {
      slug: "por-que-subio-cotizacion-envio-auto",
      title: "Por qué tu cotización de envío de auto subió a última hora",
      blurb: "El patrón de carnada y cambio explicado: cómo funciona, por qué es rentable y las señales de alerta.",
    },
  ],
  primaryCta: {
    eyebrow: "¿Listo para un número con el que puedas planear?",
    title: "Obtén un precio bloqueado y todo incluido para tu ruta exacta",
    body: "Dos códigos postales y un vehículo. Precio de mercado en vivo, bloqueado en cuanto lo ves, sin depósito. Te atendemos en español.",
    href: "/quote",
    label: "Cotizar ahora",
  },
};
