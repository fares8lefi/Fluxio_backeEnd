/*
  Warnings:

  - The primary key for the `categorie` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `movement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `movementitem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `product` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `suppliers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `productcategorie` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `movement` DROP FOREIGN KEY `Movement_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `movement` DROP FOREIGN KEY `Movement_supplierId_fkey`;

-- DropForeignKey
ALTER TABLE `movementitem` DROP FOREIGN KEY `MovementItem_movementId_fkey`;

-- DropForeignKey
ALTER TABLE `movementitem` DROP FOREIGN KEY `MovementItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `product` DROP FOREIGN KEY `Product_supplierId_fkey`;

-- DropForeignKey
ALTER TABLE `productcategorie` DROP FOREIGN KEY `ProductCategorie_categorieId_fkey`;

-- DropForeignKey
ALTER TABLE `productcategorie` DROP FOREIGN KEY `ProductCategorie_productId_fkey`;

-- AlterTable
ALTER TABLE `categorie` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `movement` DROP PRIMARY KEY,
    ADD COLUMN `clientId` VARCHAR(191) NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `supplierId` VARCHAR(191) NULL,
    MODIFY `createdById` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `movementitem` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `movementId` VARCHAR(191) NOT NULL,
    MODIFY `productId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `product` DROP PRIMARY KEY,
    ADD COLUMN `categorieId` VARCHAR(191) NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `supplierId` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `suppliers` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `user` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `productcategorie`;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `matriculeFiscale` VARCHAR(191) NOT NULL,
    `codeTva` DOUBLE NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `userId` VARCHAR(191) NULL,

    UNIQUE INDEX `Client_phone_key`(`phone`),
    UNIQUE INDEX `Client_matriculeFiscale_key`(`matriculeFiscale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categorieId_fkey` FOREIGN KEY (`categorieId`) REFERENCES `Categorie`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovementItem` ADD CONSTRAINT `MovementItem_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `Movement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MovementItem` ADD CONSTRAINT `MovementItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
