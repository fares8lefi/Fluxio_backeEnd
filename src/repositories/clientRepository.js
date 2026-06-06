const prisma = require('../../config/db');


const addClient = async (data) => {

    return  prisma.client.create({
        data: data
    });
}

const getClientByMatriculeFiscale = async (matricule) => {
    return   prisma.client.findUnique(
        {
            where:{
                matriculeFiscale:matricule,
            }
        }
    )
}

const updateClient = async (id,updates) => {
    return  prisma.client.update({where :{
        id: id,},
        data : updates
        })
}
 const deleteClient = async (id) => {
    return prisma.client.delete({
        where :{
            id:id,
        }
    })
 }
 const getClientByID = async (id) => {
    return   prisma.client.findUnique({where:{id}})
 }

 const getAllClients = async () => {
    const clients = await   prisma.client.findMany()
     if(clients.length ===0){
         const error = new Error('client not found')
         error.statusCode = 404
         throw error
     }
     return clients
 }
const searchClientsByName = async (name) => {
    const clients = await prisma.client.findMany({
        where: {
            name: {
                contains: name,
            }
        }
    })

    if (clients.length === 0) {
        const error = new Error('no clients found')
        error.statusCode = 404
        throw error
    }

    return clients
}

module.exports = {
    addClient,
    getClientByMatriculeFiscale,
    getAllClients,
    updateClient,
    deleteClient,
    getClientByID,
    searchClientsByName
}