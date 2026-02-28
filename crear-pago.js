const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items, email, nombre } = JSON.parse(event.body);

    if (!items || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Carrito vacío' }) };
    }

    const apiKey    = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const apiUrl    = process.env.FLOW_API_URL;

    const amount    = items.reduce((sum, i) => sum + i.price, 0);
    const comercioOrder = 'INYPRO-' + Date.now();
    const subject   = items.map(i => i.name).join(', ');

    const params = {
      apiKey,
      amount: String(amount),
      commerceOrder: comercioOrder,
      currency: 'CLP',
      email: email || 'cliente@inypro.cl',
      subject: subject.substring(0, 200),
      urlConfirmation: 'https://inypro.netlify.app/.netlify/functions/confirmar-pago',
      urlReturn: 'https://inypro.netlify.app/gracias.html',
    };

    // Firma requerida por Flow
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
      console.error('Flow error:', data);
      return { statusCode: 500, body: JSON.stringify({ error: 'Error al crear pago en Flow', detail: data }) };
    }

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
