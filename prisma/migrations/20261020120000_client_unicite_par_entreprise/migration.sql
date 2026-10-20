-- Unicité des clients par entreprise (téléphone et matricule fiscal)
-- DropIndex
DROP INDEX `Client_phone_key` ON `Client`;

-- DropIndex
DROP INDEX `Client_matriculeFiscale_key` ON `Client`;

-- CreateIndex
CREATE UNIQUE INDEX `Client_companyId_phone_key` ON `Client`(`companyId`, `phone`);

-- CreateIndex
CREATE UNIQUE INDEX `Client_companyId_matriculeFiscale_key` ON `Client`(`companyId`, `matriculeFiscale`);
