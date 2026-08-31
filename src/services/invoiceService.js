const invoiceRepository = require('../repositories/invoiceRepository');
const mouvmentRepository = require('../repositories/mouvmentRepository');

const generateInvoiceFromMovement = async (movementId, companyId) => {
    const movement = await mouvmentRepository.getById(movementId, companyId);
    if (!movement) {
        const err = new Error("Mouvement introuvable");
        err.statusCode = 404;
        throw err;
    }

    if (movement.type !== 'OUT') {
        const err = new Error("Seules les sorties (ventes) peuvent générer une facture");
        err.statusCode = 400;
        throw err;
    }

    // Vérification doublon : une facture existe déjà pour ce mouvement ?
    const existing = await invoiceRepository.getInvoiceByMovementId(movementId, companyId);
    if (existing) {
        const err = new Error(`Une facture existe déjà pour ce mouvement : ${existing.reference}`);
        err.statusCode = 409;
        throw err;
    }

    let total_ht = 0;
    let tva_amount = 0;

    // Les produits sont déjà inclus dans movement.items grâce à { product: true }
    for (const item of movement.items) {
        const lineTotalHT = item.quantity * item.unit_price;
        const lineTVA = lineTotalHT * ((item.product?.tva_rate ?? 19) / 100);
        total_ht += lineTotalHT;
        tva_amount += lineTVA;
    }

    const timbre_fiscal = 1.000;
    const total_ttc = parseFloat((total_ht + tva_amount + timbre_fiscal).toFixed(3));
    total_ht     = parseFloat(total_ht.toFixed(3));
    tva_amount   = parseFloat(tva_amount.toFixed(3));

    const reference = `FACT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return await invoiceRepository.createInvoice({
        reference,
        total_ht,
        tva_amount,
        timbre_fiscal,
        total_ttc,
        status: 'PENDING',
        movementId,
        clientId: movement.clientId || null,
        companyId,
    });
};

const getInvoicePdfData = async (invoiceId, companyId) => {
    const invoice = await invoiceRepository.getInvoiceById(invoiceId, companyId);
    if (!invoice) throw new Error("Facture introuvable");
    
    // Le front-end a besoin de toutes ces informations structurées
    return {
        company: {
            name: invoice.company.name,
            matriculeFiscale: invoice.company.matriculeFiscale || "N/A",
            address: invoice.company.address || "N/A",
            phone: invoice.company.phone || "N/A",
        },
        client: invoice.client ? {
            name: invoice.client.name,
            matriculeFiscale: invoice.client.matriculeFiscale || "N/A",
            phone: invoice.client.phone || "N/A",
            address: invoice.client.address || "N/A",
        } : null,
        invoiceDetails: {
            reference: invoice.reference,
            date: invoice.date,
            status: invoice.status,
            timbre_fiscal: invoice.timbre_fiscal,
            total_ht: invoice.total_ht,
            tva_amount: invoice.tva_amount,
            total_ttc: invoice.total_ttc,
        },
        items: invoice.movement.items.map(item => ({
            productName: item.product.name,
            quantity: item.quantity,
            unitPriceHT: item.unit_price,
            tvaRate: item.product.tva_rate || 19,
            totalLineHT: item.quantity * item.unit_price,
        }))
    };
};

const getAllInvoices = async (page, companyId, filters = {}) => {
    const limit = parseInt(process.env.limitByPage) || 10;
    const numbrePage = parseInt(page) || 1;

    const invoices = await invoiceRepository.findPaginated(numbrePage, limit, companyId, filters);
    const count = await invoiceRepository.countAll(companyId, filters);

    return { invoices, count };
};

const updateInvoiceStatus = async (invoiceId, status, companyId) => {
    if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
        throw new Error("Statut invalide");
    }
    return await invoiceRepository.updateStatus(invoiceId, status, companyId);
};

module.exports = {
    generateInvoiceFromMovement,
    getInvoicePdfData,
    getAllInvoices,
    updateInvoiceStatus
};
