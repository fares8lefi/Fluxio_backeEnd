-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `apply_rs` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `attestation_ref` VARCHAR(191) NULL,
    ADD COLUMN `invoice_type` ENUM('SALE', 'CREDIT_NOTE', 'PROFORMA') NOT NULL DEFAULT 'SALE',
    ADD COLUMN `is_suspended` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `net_payable` DOUBLE NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `original_invoice_id` VARCHAR(191) NULL,
    ADD COLUMN `payment_terms` VARCHAR(191) NULL,
    ADD COLUMN `purchase_order_ref` VARCHAR(191) NULL,
    ADD COLUMN `rs_amount` DOUBLE NOT NULL DEFAULT 0.0,
    ADD COLUMN `rs_rate` DOUBLE NOT NULL DEFAULT 1.0,
    ADD COLUMN `tva_breakdown` TEXT NULL;

-- CreateTable
CREATE TABLE `Quote` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `valid_until` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `total_ht` DOUBLE NOT NULL DEFAULT 0,
    `tva_amount` DOUBLE NOT NULL DEFAULT 0,
    `total_ttc` DOUBLE NOT NULL DEFAULT 0,
    `is_suspended` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `payment_terms` VARCHAR(191) NULL,
    `items` TEXT NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quote_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

