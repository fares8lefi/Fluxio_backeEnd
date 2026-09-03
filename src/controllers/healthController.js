const prisma = require("../../config/db");

// GET /health
module.exports.getHealth = async (req, res) => {
    const startTime = Date.now();

    // Test DB connection
    let dbStatus = "ok";
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
        dbStatus = "error";
    }

    const responseTime = Date.now() - startTime;
    const httpStatus = dbStatus === "ok" ? 200 : 503;

    return res.status(httpStatus).json({
        success: dbStatus === "ok",
        status: dbStatus === "ok" ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        responseTime: responseTime + "ms",
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        services: {
            database: dbStatus,
            server: "ok",
        },
    });
};
