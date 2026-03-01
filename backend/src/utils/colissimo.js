const fetch = require('node-fetch');
const FormData = require('form-data');

/**
 * Genere une etiquette Colissimo via l'API REST
 * @param {Object} order - Commande avec customer et shipping
 * @returns {{ trackingNumber: string, labelPdf: Buffer }}
 */
async function generateLabel(order) {
    const contractNumber = process.env.COLISSIMO_CONTRACT_NUMBER;
    const password = process.env.COLISSIMO_PASSWORD;

    if (!contractNumber || !password) {
        throw new Error('Variables Colissimo non configurees (COLISSIMO_CONTRACT_NUMBER, COLISSIMO_PASSWORD)');
    }

    const customer = order.customer || {};
    const shipping = order.shipping || {};

    const payload = {
        contractNumber,
        password,
        outputFormat: {
            x: 0,
            y: 0,
            outputPrintingType: 'PDF_A4_300dpi'
        },
        letter: {
            service: {
                productCode: 'DOM',
                depositDate: new Date().toISOString().split('T')[0],
                totalAmount: Math.round((order.total || 0) * 100)
            },
            parcel: {
                weight: 0.5
            },
            sender: {
                address: {
                    companyName: process.env.COLISSIMO_SENDER_COMPANY || 'COVE',
                    line2: process.env.COLISSIMO_SENDER_ADDRESS || '',
                    city: process.env.COLISSIMO_SENDER_CITY || 'Paris',
                    zipCode: process.env.COLISSIMO_SENDER_ZIPCODE || '75002',
                    countryCode: 'FR',
                    email: process.env.COLISSIMO_SENDER_EMAIL || 'contact@cove.com',
                    phoneNumber: process.env.COLISSIMO_SENDER_PHONE || ''
                }
            },
            addressee: {
                address: {
                    lastName: customer.lastName || '',
                    firstName: customer.firstName || '',
                    line2: shipping.address || '',
                    city: shipping.city || '',
                    zipCode: shipping.postalCode || '',
                    countryCode: shipping.country || 'FR',
                    email: customer.email || '',
                    phoneNumber: customer.phone || ''
                }
            }
        }
    };

    const form = new FormData();
    form.append('generateLabelRequest', JSON.stringify(payload));

    const response = await fetch(
        'https://ws.colissimo.fr/sls-ws/SlsServiceWSRest/2.0/generateLabel',
        {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Colissimo API erreur ${response.status}: ${text.substring(0, 200)}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // Reponse JSON = erreur
    if (contentType.includes('application/json')) {
        const json = await response.json();
        const msg = json.messages?.map(m => m.messageContent).join(', ') || JSON.stringify(json);
        throw new Error(`Colissimo erreur: ${msg}`);
    }

    // Reponse multipart : JSON + PDF
    if (contentType.includes('multipart')) {
        const buffer = await response.buffer();
        const boundary = extractBoundary(contentType);
        const parts = parseMultipart(buffer, boundary);

        let trackingNumber = null;
        let labelPdf = null;

        for (const part of parts) {
            if (part.contentType && part.contentType.includes('application/json')) {
                const json = JSON.parse(part.body.toString('utf8'));
                if (json.messages) {
                    const errors = json.messages.filter(m => m.type === 'ERROR');
                    if (errors.length > 0) {
                        throw new Error(`Colissimo erreur: ${errors.map(e => e.messageContent).join(', ')}`);
                    }
                }
                trackingNumber = json.labelV2Response?.parcelNumber || json.parcelNumber || null;
            } else if (part.contentType && part.contentType.includes('application/pdf')) {
                labelPdf = part.body;
            }
        }

        if (!trackingNumber) {
            throw new Error('Colissimo: numero de suivi non trouve dans la reponse');
        }
        if (!labelPdf) {
            throw new Error('Colissimo: PDF non trouve dans la reponse');
        }

        return { trackingNumber, labelPdf };
    }

    // Reponse inattendue
    const text = await response.text();
    throw new Error(`Colissimo: reponse inattendue (${contentType}): ${text.substring(0, 200)}`);
}

function extractBoundary(contentType) {
    const match = contentType.match(/boundary=([^\s;]+)/);
    return match ? match[1].replace(/"/g, '') : null;
}

function parseMultipart(buffer, boundary) {
    const parts = [];
    const sep = Buffer.from('--' + boundary);
    const end = Buffer.from('--' + boundary + '--');

    let pos = 0;
    // Trouver le premier boundary
    pos = bufferIndexOf(buffer, sep, pos);
    if (pos === -1) return parts;
    pos += sep.length;

    while (pos < buffer.length) {
        // Sauter CRLF apres boundary
        if (buffer[pos] === 0x0d && buffer[pos + 1] === 0x0a) pos += 2;

        // Verifier fin
        const nextBoundary = bufferIndexOf(buffer, sep, pos);
        if (nextBoundary === -1) break;

        const partData = buffer.slice(pos, nextBoundary);

        // Separer headers et body (double CRLF)
        const headerEnd = bufferIndexOf(partData, Buffer.from('\r\n\r\n'), 0);
        if (headerEnd !== -1) {
            const headersStr = partData.slice(0, headerEnd).toString('utf8');
            const body = partData.slice(headerEnd + 4);
            // Retirer le CRLF final du body
            const cleanBody = body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a
                ? body.slice(0, body.length - 2)
                : body;

            const contentTypeMatch = headersStr.match(/Content-Type:\s*(.+)/i);
            parts.push({
                contentType: contentTypeMatch ? contentTypeMatch[1].trim() : null,
                body: cleanBody
            });
        }

        pos = nextBoundary + sep.length;
        // Verifier si c'est le end boundary
        if (buffer.slice(nextBoundary, nextBoundary + end.length).equals(end)) break;
    }

    return parts;
}

function bufferIndexOf(buffer, search, fromIndex) {
    for (let i = fromIndex; i <= buffer.length - search.length; i++) {
        let found = true;
        for (let j = 0; j < search.length; j++) {
            if (buffer[i + j] !== search[j]) {
                found = false;
                break;
            }
        }
        if (found) return i;
    }
    return -1;
}

module.exports = { generateLabel };
