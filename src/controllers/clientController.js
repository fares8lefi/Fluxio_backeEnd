const clientService = require('../services/clientService');



module.exports.createClient = async (req, res) => {
    try {

        const client = await clientService.createClient(req.body);
        return res.status(201).json({ success: true, client });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });
    }
};

module.exports.updateClient= async (req, res) => {
    try{
        const id = req.params.id;
        const update = await clientService.updateClient(id,req.body);
        return res.status(201).json({ success: true, update });

    }catch(error){
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        });

    }
}

module.exports.deleteClient = async (req, res) => {
    try {
        const id = req.params.id;
        await clientService.deleteClient(id);
        res.status(204).json({success: true, message: 'Client deleted successfully.'});

    }catch(error){
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        })
    }
}

module.exports.getAllClients = async (_req, res) => {
    try{
        const clients = await clientService.getAllClients()
        res.status(200).json({success: true, clients});
    }catch(error){
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        })
    }
}

module.exports.getClientByMatriculeFiscale= async (req, res) => {
   try{
       console.log(req.params.mf);
       const client = await clientService.getClientByMatriculeFiscale(req.params.mf);
       return res.status(200).json({success: true, client});

   }catch(error){
       const statusCode = error.statusCode || 500;
       return res.status(statusCode).json({
           success: false,
           message: error.message,
           ...(error.details && { details: error.details }),
       })
   }
}

module.exports.searchClientsByName = async (req, res) => {
    try {
        const clients = await clientService.searchClientsByName(req.query.name);
        res.status(200).json({success: true, clients});
    }catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && { details: error.details }),
        })
    }
}