-- AlterTable
ALTER TABLE `User` ADD COLUMN `company_role` ENUM('OWNER', 'STOCK', 'ACCOUNTANT') NOT NULL DEFAULT 'OWNER';

-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `matriculeFiscale` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Movement` ADD COLUMN `adjustment_reason` ENUM('INVENTORY', 'BREAKAGE', 'LOSS', 'EXPIRED', 'OTHER') NULL,
    ADD COLUMN `supplier_invoice_date` DATETIME(3) NULL,
    ADD COLUMN `supplier_invoice_ref` VARCHAR(191) NULL,
    MODIFY `type` ENUM('IN', 'OUT', 'RETURN_SUPPLIER', 'RETURN_CLIENT', 'ADJUSTMENT') NOT NULL;

-- AlterTable
ALTER TABLE `MovementItem` ADD COLUMN `purchase_price` DOUBLE NULL,
    ADD COLUMN `tva_rate` INTEGER NULL;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `company_role` ENUM('OWNER', 'STOCK', 'ACCOUNTANT') NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId` VARCHAR(191) NOT NULL,
    `invitedById` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Invitation_token_hash_key`(`token_hash`),
    INDEX `Invitation_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_invitedById_fkey` FOREIGN KEY (`invitedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Lignes existantes : taux de TVA et prix d achat repris de la fiche produit actuelle
UPDATE `MovementItem` mi JOIN `Product` p ON p.`id` = mi.`productId` SET mi.`tva_rate` = p.`tva_rate`, mi.`purchase_price` = p.`purchase_price` WHERE mi.`tva_rate` IS NULL;
