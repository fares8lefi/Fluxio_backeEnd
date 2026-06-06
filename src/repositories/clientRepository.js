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
 const getClinetByID = async (id) => {
    return   prisma.client.findUnique({where:{id}})
 }

 const getAllClients = async (id) => {
    return   prisma.client.findMany()
 }
module.exports = {
    addClient,
    getClientByMatriculeFiscale,
    getAllClients,
    updateClient,
    deleteClient,
    getClinetByID
}