-- DropForeignKey
ALTER TABLE `Invoice` DROP FOREIGN KEY `Invoice_movementId_fkey`;

-- DropIndex
DROP INDEX `Invoice_reference_key` ON `Invoice`;

-- DropIndex
DROP INDEX `Quote_reference_key` ON `Quote`;

-- AlterTable
ALTER TABLE `Invoice` MODIFY `movementId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Invoice_companyId_reference_key` ON `Invoice`(`companyId`, `reference`);

-- CreateIndex
CREATE UNIQUE INDEX `Quote_companyId_reference_key` ON `Quote`(`companyId`, `reference`);

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_movementId_fkey` FOREIGN KEY (`movementId`) REFERENCES `Movement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

