/**
 * Phase A blog article #2 (replacement for pagar-deposito-envio-auto-conductor).
 * Topic: Why your auto transport quote might not hold.
 * Spanish version of why-quotes-dont-hold (created 2026-06-22).
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "por-que-las-cotizaciones-no-aguantan",
  language: "es",
  title: "Por qué su cotización de transporte de auto puede no aguantar (y qué buscar)",
  subtitle:
    "Una primera cotización baja no siempre significa un precio justo. Aquí está por qué algunas cotizaciones se suben después de reservar, cómo identificar cuáles están en riesgo, y las cuatro preguntas que puede hacerle a cualquier broker para averiguarlo.",
  metaDescription:
    "Por qué las cotizaciones de transporte de autos se suben después de reservar, las fuentes de datos que usan los brokers, y las cuatro preguntas que debe hacerle a un broker antes de pagar un depósito de reserva.",
  publishedAt: "2026-06-22",
  updatedAt: "2026-06-22",
  author: "Auto Line Logistics",
  readMinutes: 7,
  category: "Guía del comprador",
  cluster: "avoiding-scams",
  hubLink: { label: "Guía anti-estafa", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "Llamó a cinco brokers para el mismo envío. Uno vino $300 por debajo del resto. Pagó un pequeño depósito de reserva. Ocho días después, el broker llama de vuelta: «No podemos encontrar un transportista a ese precio. Necesitamos $400 más, o puede cancelar y perder el depósito».",
        "¿Es una estafa? ¿Es un contratiempo normal? ¿O es algo intermedio?",
        "La respuesta honesta: depende de por qué la cotización fue tan baja en primer lugar. Algunos brokers saben que su primera cotización no aguantará. Cotizan bajo a propósito para convencerlo por teléfono, y luego renegocian una vez que su depósito está adentro. La industria llama a esto el bait-and-bump (cebo y aumento). Este artículo explica cómo funciona, por qué funciona, y las cuatro preguntas que puede hacerle a cualquier broker para averiguar si su cotización aguantará.",
      ],
    },

    { kind: "h2", text: "Tres razones por las que una cotización deja de aguantar" },
    {
      kind: "pp",
      texts: [
        "Hay tres formas en que un broker puede llegar al número que le muestra, y cada una tiene una probabilidad diferente de aguantar una vez que usted ha pagado el depósito.",
      ],
    },

    { kind: "h3", text: "1. La cotización se basó en promedios viejos" },
    {
      kind: "pp",
      texts: [
        "Algunos brokers cotizan su envío usando promedios de cargas pasadas en rutas similares. El número se ve razonable. El problema es que ese número no sabe qué pasó esta semana. Los precios del combustible pueden haber cambiado. La capacidad de transportistas puede estar más ajustada de lo usual. Una tormenta puede haber desviado la mitad de los camiones cruzando su corredor. El número en la página es una suposición basada en historia, no un número que algún transportista haya confirmado que tomará hoy.",
        "Cuando la realidad no coincide con la suposición, el broker tiene dos opciones. Asumir la diferencia ellos mismos, o llamarlo de vuelta pidiendo más dinero. La mayoría escoge la segunda.",
      ],
    },

    { kind: "h3", text: "2. La cotización se publicó antes de que un transportista la aceptara" },
    {
      kind: "pp",
      texts: [
        "Algunos brokers publican su envío en una plataforma de la industria (una plataforma privada donde los transportistas ven trabajos y deciden cuáles tomar) antes de que algún transportista haya aceptado el precio. El broker le muestra un número, toma su depósito, y luego espera a ver si alguien realmente aceptará el trabajo a ese número.",
        "Cuando ningún transportista acepta, el broker tiene que subir el precio publicado (lo cual significa pedirle más dinero) o seguir publicando al número original y esperar que alguien lo tome antes de su fecha de recogida. Si nada cambia para la fecha límite, recibe la llamada.",
      ],
    },

    { kind: "h3", text: "3. El depósito se tomó antes de que se conociera el precio real" },
    {
      kind: "pp",
      texts: [
        "Este es el problema estructural detrás de los dos primeros. Los brokers que usan datos viejos o publican-antes-de-confirmar saben que hay una probabilidad de que su primera cotización no aguante. El depósito les da el apalancamiento para renegociar. Usted puede pagar el precio más alto, o puede perder el depósito. La mayoría de los clientes pagan porque ya planearon alrededor del envío.",
        "Un depósito por sí mismo no es una bandera roja. Cada broker establecido cobra alguna forma de depósito de reserva para cubrir la coordinación de despacho. La bandera roja es cuando el depósito se toma antes de que la cotización haya sido validada contra la realidad.",
      ],
    },

    {
      kind: "quote",
      text: "Tuvieron mi depósito de $200 por 11 días. Cada vez que preguntaba cuándo asignarían mi transportista, decían «pronto». El día 12 me llamaron para decirme que no podían conseguir un conductor al precio original y necesitaban $400 más. Debí haber hecho la pregunta del depósito el primer día.",
      source: "Textual de un hilo de r/AutoTransport de 2024",
    },

    { kind: "h2", text: "El bait-and-bump, en términos simples" },
    {
      kind: "pp",
      texts: [
        "El bait-and-bump es el final predecible de los patrones de arriba. La primera cotización es el cebo. Lo hace elegir a este broker en vez de los otros cuatro que llamó. El depósito es el ancla. Una vez que lo ha pagado, está comprometido. La segunda cotización, dos semanas después, es el precio real.",
        "Los brokers que corren este patrón no siempre están tratando de estafarlo. Algunos están genuinamente sobrecargados y cotizan optimistamente porque la alternativa es perder el cliente con un competidor. El resultado para usted es el mismo: la cotización que reservó no es la cotización que paga.",
      ],
    },

    { kind: "h2", text: "Cuatro preguntas que hacerle a cualquier broker antes de pagar nada" },
    {
      kind: "pp",
      texts: [
        "Cualquier broker honesto puede contestar estas cuatro preguntas sin vacilar. Si un broker esquiva, da respuestas vagas, o lo empuja a pagar antes de contestar, la cotización está en riesgo.",
      ],
    },
    {
      kind: "ol",
      items: [
        "¿Cómo llegan a su cotización? ¿Precios en vivo de transportistas, o promedios de envíos pasados? Respuesta honesta: datos del mercado en vivo refrescados al momento de la cotización. Respuesta riesgosa: un vago «usamos datos históricos» o «se basa en el mercado».",
        "¿Tienen un transportista confirmado para mi ruta a este precio, o lo están publicando para esperar ofertas? Respuesta honesta: un transportista confirmado dentro de horas de la reserva, o una explicación clara de cómo funciona el proceso de publicar-y-esperar. Respuesta riesgosa: «le encontraremos uno, no se preocupe».",
        "¿Qué pasa exactamente con mi depósito si ningún transportista acepta al precio cotizado? Respuesta honesta: un compromiso específico por escrito (retenido hasta que el transportista acepte, totalmente reembolsable, aplicado al precio más alto si usted está de acuerdo). Respuesta riesgosa: «es poco probable que pase».",
        "¿Pondrán la promesa de estabilidad de cotización por escrito? Respuesta honesta: sí, en el contrato que firma antes de pagar. Respuesta riesgosa: cualquier versión de «no hacemos eso, pero prometemos».",
      ],
    },

    { kind: "h2", text: "Cómo Auto Line Logistics cotiza" },
    {
      kind: "pp",
      texts: [
        "Usamos datos del mercado de transportistas en vivo, refrescados al momento en que usted pide una cotización. Podemos ver lo que los transportistas en nuestra red están aceptando hoy, en su ruta específica, para su vehículo específico. Agregamos un margen justo encima para cubrir la coordinación de despacho, el manejo de reclamos, y el soporte de coordinador asignado que usted recibe desde la reserva hasta la entrega. El número que ve es el número que paga.",
        "Como muchos brokers establecidos, cobramos un pequeño depósito de reserva cuando usted decide avanzar. El depósito va hacia su factura final. La diferencia es lo que pasa después. No usamos el depósito como apalancamiento para un cambio de precio, porque nuestro precio se basó en lo que los transportistas realmente estaban aceptando en primer lugar. El precio fijo aguanta.",
        "Si un transportista no puede ser confirmado a su precio fijo (poco común en los corredores que operamos activamente), se lo decimos por adelantado. Usted decide qué pasa después: mantenerse y esperar que un transportista acepte, ajustar a un nuevo precio si está de acuerdo, o reembolsar su depósito. La decisión es suya.",
      ],
    },
  ],
  related: [
    {
      slug: "por-que-subio-cotizacion-envio-auto",
      title: "Por qué subió su cotización a último momento",
      blurb: "La mecánica del patrón bait-and-bump en términos simples.",
    },
  ],
  primaryCta: {
    eyebrow: "Verifique las cuentas de su ruta",
    title: "Obtenga un precio de transportista en vivo para su ruta",
    body: "Mándenos su ruta y vehículo. Le mostraremos lo que nuestra red de transportistas está aceptando hoy, para que pueda detectar una cotización cebo antes de que le cueste. Sin compromiso, sin registro.",
    href: "/tools/route-price-checker",
    label: "Obtenga mi precio fijo",
  },
  faq: [
    {
      q: "¿Cuánto debería tardar un broker en asignar un transportista?",
      a: "Depende de la ruta. Corredores populares (California a Texas, California a Florida, corredores de snowbirds) típicamente consiguen un transportista dentro de 1 a 3 días. Recogidas remotas o rutas inusuales pueden tomar 5 a 10 días. Si un broker ha tenido su depósito por 7+ días sin confirmar un transportista, pregunte directamente cuándo aceptará un transportista y qué pasa con su depósito si no pueden.",
    },
    {
      q: "¿Es normal pagar un pequeño depósito al reservar?",
      a: "Sí. La mayoría de los brokers establecidos cobran un pequeño depósito de reserva (típicamente $100 a $250) cuando usted decide avanzar. El depósito cubre la coordinación de despacho y va hacia su factura final. El riesgo no es el depósito en sí. El riesgo es si el broker puede aguantar el precio cotizado después de tomar su dinero.",
    },
    {
      q: "¿Con qué debería pagar un depósito de transporte de auto?",
      a: "Tarjeta de crédito, siempre. Las disputas de tarjeta de crédito le dan recurso si el broker resulta usar un modelo de precio cebo. Transferencias bancarias, tarjetas de débito, y aplicaciones como Zelle o Venmo no ofrecen protección equivalente. Si un broker insiste en un método de pago que no sea tarjeta, eso por sí mismo es una bandera roja.",
    },
    {
      q: "¿Qué hace Auto Line Logistics si un transportista no puede ser confirmado al precio cotizado?",
      a: "Se lo decimos por adelantado antes de que algo cambie. Usted decide qué pasa después: mantenerse y esperar que un transportista acepte al precio original, ajustar a un nuevo precio si está de acuerdo que es justo, o reembolsar su depósito y caminar. La decisión es suya y lo ponemos por escrito.",
    },
    {
      q: "¿Cuál es el monto típico de un depósito de transporte de auto?",
      a: "A través de la industria, los depósitos van de $0 (raro, mayormente brokers de alta gama con su propia red de transportistas) a $500+ (cuestionable). El medio de la distribución es $150 a $250. Un depósito mayor a $250 debería venir con respuestas muy claras por escrito sobre qué pasa si ningún transportista acepta su carga al precio cotizado.",
    },
  ],
};
