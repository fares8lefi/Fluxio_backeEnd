/*
  Warnings:

  - You are about to drop the column `userId` on the `client` table. All the data in the column will be lost.
  - You are about to alter the column `codeTva` on the `client` table. The data in that column could be lost. The data in that column will be cast from `Double` to `VarChar(191)`.
  - You are about to drop the column `unit` on the `movementitem` table. All the data in the column will be lost.
  - You are about to drop the column `categorieId` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `product` table. All the data in the column will be lost.
  - You are about to drop the `categorie` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `suppliers` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `quantity` to the `MovementItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `unit_price` on table `movementitem` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `client` DROP FOREIGN KEY `Client_userId_fkey`;

-- DropForeignKey
ALTER TABLE `movement` DROP FOREIGN KEY `Movement_supplierId_fkey`;

-- DropForeignKey
ALTER TABLE `product` DROP FOREIGN KEY `Product_categorieId_fkey`;

-- DropForeignKey
ALTER TABLE `product` DROP FOREIGN KEY `Product_supplierId_fkey`;

-- AlterTable
ALTER TABLE `client` DROP COLUMN `userId`,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    MODIFY `codeTva` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `movement` ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `total_amount` DOUBLE NULL;

-- AlterTable
ALTER TABLE `movementitem` DROP COLUMN `unit`,
    ADD COLUMN `quantity` INTEGER NOT NULL,
    MODIFY `unit_price` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `categorieId`,
    DROP COLUMN `unit`,
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `stock_max` INTEGER NULL,
    ADD COLUMN `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tva_rate` INTEGER NOT NULL DEFAULT 19,
    ADD COLUMN `unit_of_measure` VARCHAR(191) NOT NULL DEFAULT 'pièce',
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `code_expires_at` DATETIME(3) NULL,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `refreshToken` TEXT NULL;

-- DropTable
DROP TABLE `categorie`;

-- DropTable
DROP TABLE `suppliers`;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` INTEGER NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId` VARCHAR(191) NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` INTEGER NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId` VARCHAR(191) NULL,

    UNIQUE INDEX `Supplier_code_key`(`code`),
    UNIQUE INDEX `Supplier_email_key`(`email`),
    UNIQUE INDEX `Supplier_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
