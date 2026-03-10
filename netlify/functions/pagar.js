const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 1. Recibimos el ID del producto enviado desde tu HTML
    const { productId } = JSON.parse(event.body);

    // 2. Definimos precios en el servidor (la "fuente de verdad")
    const precios = { "filtro": 179990, "cerrojo": 139900 };

    // 3. Llamada segura a Flow usando tus variables ya configuradas
    const response = await fetch('https://api.flow.cl/v2/payment/create', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: `apiKey=${process.env.FLOW_API_KEY}&secretKey=${process.env.FLOW_SECRET_KEY}&commerceOrder=ORDEN123&subject=Compra&currency=CLP&amount=${precios[productId]}&email=cliente@email.com&urlReturn=https://inypro.netlify.app/gracias`
    });

    const data = await response.json();
    return {
        statusCode: 200,
        body: JSON.stringify(data)
    };
};
