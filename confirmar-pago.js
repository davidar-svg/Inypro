const crypto = require('crypto');

exports.handler = async (event) => {
  try {
    const params = event.httpMethod === 'POST'
      ? Object.fromEntries(new URLSearchParams(event.body))
      : event.queryStringParameters;

    const token = params.token;
    if (!token) {
      return { statusCode: 400, body: 'Token requerido' };
    }

    const apiKey    = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const apiUrl    = process.env.FLOW_API_URL;

    // Consultar estado del pago a Flow
    const queryParams = { apiKey, token };
    const keys = Object.keys(queryParams).sort();
    let toSign = '';
    keys.forEach(k => { toSign += k + queryParams[k]; });
    queryParams.s = crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');

    const qs = new URLSearchParams(queryParams).toString();
    const response = await fetch(`${apiUrl}/payment/getStatus?${qs}`);
    const data = await response.json();

    // Status 2 = pago exitoso en Flow
    if (data.status === 2) {
      console.log(`✅ Pago confirmado: Orden ${data.commerceOrder} | Monto $${data.amount} CLP`);
    } else {
      console.log(`⚠️ Pago no completado: Orden ${data.commerceOrder} | Status ${data.status}`);
    }

    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Error webhook:', err);
    return { statusCode: 500, body: err.message };
  }
};
