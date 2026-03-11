const crypto = require('crypto');

// =====================================================================
// CATÁLOGO AUTORITATIVO DE PRECIOS — solo este archivo define los precios.
// El frontend NUNCA envía precios, solo IDs.
// =====================================================================
const CATALOGO = {
  'filtro-agua':     { nombre: 'Pack Filtración de Agua',   precio: 179990 },
  'cerrojo-digital': { nombre: 'Cerrojo Digital de Huella', precio: 139900 },
  'cenefa-modular':  { nombre: 'Cenefa Modular',            precio: 75000  },
  'mesa-centro':     { nombre: 'Mesa de Centro',            precio: 175000 },
  'inspeccion':      { nombre: 'Inspección Técnica',        precio: 129000 },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, email, nombre, horario } = JSON.parse(event.body);

    // --- Validación de entrada ---
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrito vacío' }) };
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email inválido' }) };
    }

    // --- Calcular total desde el catálogo del servidor (nunca del cliente) ---
    let totalCalculado = 0;
    const nombresProductos = [];

    for (const id of items) {
      const producto = CATALOGO[id];
      if (!producto) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Producto no reconocido: ${id}` }),
        };
      }
      totalCalculado += producto.precio;
      nombresProductos.push(producto.nombre);
    }

    if (totalCalculado <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Total inválido' }) };
    }

    // --- Variables de entorno ---
    const apiKey    = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const apiUrl    = process.env.FLOW_API_URL;

    if (!apiKey || !secretKey || !apiUrl) {
      console.error('Variables de entorno de Flow no configuradas');
      return { statusCode: 500, body: JSON.stringify({ error: 'Error de configuración del servidor' }) };
    }

    // --- Construir subject del pago ---
    let subject = nombresProductos.join(', ');
    if (horario) subject += ` – ${horario}`;
    subject = subject.substring(0, 200);

    // --- Parámetros para Flow ---
    const comercioOrder = 'INYPRO-' + Date.now();

    const params = {
      apiKey,
      amount:         String(totalCalculado),
      commerceOrder:  comercioOrder,
      currency:       'CLP',
      email:          email,
      subject:        subject,
      urlConfirmation: 'https://inypro.netlify.app/.netlify/functions/confirmar-pago',
      urlReturn:       'https://inypro.netlify.app/gracias.html',
    };

    // --- Firma HMAC-SHA256 (requerida por Flow) ---
    const keys = Object.keys(params).sort();
    let toSign = '';
    keys.forEach(k => { toSign += k + params[k]; });
    params.s = crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');

    const body = new URLSearchParams(params).toString();

    const response = await fetch(`${apiUrl}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.json();

    if (data.url && data.token) {
      return {
        statusCode: 200,
        body: JSON.stringify({ redirectUrl: `${data.url}?token=${data.token}` }),
      };
    } else {
      console.error('Respuesta inesperada de Flow:', data);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.message || 'Error al crear pago en Flow', code: data.code }),
      };
    }

  } catch (err) {
    console.error('Error en crear-pago:', err.message);
    // No exponer detalles internos al cliente
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno del servidor' }) };
  }
};
