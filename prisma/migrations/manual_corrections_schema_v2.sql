-- ============================================================
-- Migration manuelle : corrections_schema_v2
-- Ordre correct pour MySQL : supprimer FK d'abord, puis index,
-- puis modifier les tables, puis recréer les tables et FK.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Supprimer les Foreign Keys existantes
-- ─────────────────────────────────────────
ALTER TABLE `client`       DROP FOREIGN KEY `Client_companyId_fkey`;
ALTER TABLE `client`       DROP FOREIGN KEY `Client_userId_fkey`;
ALTER TABLE `movement`     DROP FOREIGN KEY `Movement_clientId_fkey`;
ALTER TABLE `movement`     DROP FOREIGN KEY `Movement_companyId_fkey`;
ALTER TABLE `movement`     DROP FOREIGN KEY `Movement_createdById_fkey`;
ALTER TABLE `movement`     DROP FOREIGN KEY `Movement_supplierId_fkey`;
ALTER TABLE `movementitem` DROP FOREIGN KEY `MovementItem_movementId_fkey`;
ALTER TABLE `movementitem` DROP FOREIGN KEY `MovementItem_productId_fkey`;
ALTER TABLE `product`      DROP FOREIGN KEY `Product_categorieId_fkey`;
ALTER TABLE `product`      DROP FOREIGN KEY `Product_companyId_fkey`;
ALTER TABLE `product`      DROP FOREIGN KEY `Product_supplierId_fkey`;
ALTER TABLE `user`         DROP FOREIGN KEY `User_companyId_fkey`;

-- ─────────────────────────────────────────
-- 2. Supprimer les Index devenus libres
-- ─────────────────────────────────────────
DROP INDEX `Client_companyId_fkey`      ON `client`;
DROP INDEX `Client_userId_fkey`         ON `client`;
DROP INDEX `Movement_clientId_fkey`     ON `movement`;
DROP INDEX `Movement_companyId_fkey`    ON `movement`;
DROP INDEX `Movement_createdById_fkey`  ON `movement`;
DROP INDEX `Movement_supplierId_fkey`   ON `movement`;
DROP INDEX `MovementItem_movementId_fkey` ON `movementitem`;
DROP INDEX `MovementItem_productId_fkey`  ON `movementitem`;
DROP INDEX `Product_categorieId_fkey`   ON `product`;
DROP INDEX `Product_companyId_fkey`     ON `product`;
DROP INDEX `Product_supplierId_fkey`    ON `product`;
DROP INDEX `User_companyId_fkey`        ON `user`;

-- ─────────────────────────────────────────
-- 3. Modifier les tables existantes
-- ─────────────────────────────────────────

-- Client : supprimer userId, changer codeTva de Float → VARCHAR
ALTER TABLE `client`
    DROP COLUMN `userId`,
    MODIFY `codeTva` VARCHAR(191) NULL;

-- Movement : ajouter total_amount
ALTER TABLE `movement`
    ADD COLUMN `total_amount` DOUBLE NULL;

-- MovementItem : renommer unit → quantity, rendre unit_price NOT NULL
ALTER TABLE `movementitem`
    DROP COLUMN `unit`,
    ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 0,
    MODIFY `unit_price` DOUBLE NOT NULL DEFAULT 0;

-- Product : renommer categorieId → categoryId, unit → stock_quantity, supprimer price_ht/price_ttc
ALTER TABLE `product`
    DROP COLUMN `categorieId`,
    DROP COLUMN `price_ht`,
    DROP COLUMN `price_ttc`,
    DROP COLUMN `unit`,
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `stock_quantity` INTEGER NOT NULL DEFAULT 0;

-- User : ajouter code_expires_at
ALTER TABLE `user`
    ADD COLUMN `code_expires_at` DATETIME(3) NULL;

-- ─────────────────────────────────────────
-- 4. Supprimer les anciennes tables
-- ─────────────────────────────────────────
DROP TABLE `categorie`;
DROP TABLE `suppliers`;

-- ─────────────────────────────────────────
-- 5. Créer les nouvelles tables
-- ─────────────────────────────────────────
CREATE TABLE `Category` (
    `id`          VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `code`        INTEGER NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_active`   BOOLEAN NOT NULL DEFAULT true,
    `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId`   VARCHAR(191) NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Supplier` (
    `id`         VARCHAR(191) NOT NULL,
    `name`       VARCHAR(191) NOT NULL,
    `code`       INTEGER NULL,
    `email`      VARCHAR(191) NULL,
    `phone`      VARCHAR(191) NOT NULL,
    `address`    VARCHAR(191) NULL,
    `is_active`  BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId`  VARCHAR(191) NULL,

    UNIQUE INDEX `Supplier_code_key`(`code`),
    UNIQUE INDEX `Supplier_email_key`(`email`),
    UNIQUE INDEX `Supplier_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────
-- 6. Recréer toutes les Foreign Keys
-- ─────────────────────────────────────────
ALTER TABLE `User`         ADD CONSTRAINT `User_companyId_fkey`             FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Category`     ADD CONSTRAINT `Category_companyId_fkey`         FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Supplier`     ADD CONSTRAINT `Supplier_companyId_fkey`         FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Product`      ADD CONSTRAINT `Product_supplierId_fkey`         FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Product`      ADD CONSTRAINT `Product_categoryId_fkey`         FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Product`      ADD CONSTRAINT `Product_companyId_fkey`          FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Movement`     ADD CONSTRAINT `Movement_supplierId_fkey`        FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Movement`     ADD CONSTRAINT `Movement_clientId_fkey`          FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Movement`     ADD CONSTRAINT `Movement_createdById_fkey`       FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Movement`     ADD CONSTRAINT `Movement_companyId_fkey`         FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MovementItem` ADD CONSTRAINT `MovementItem_movementId_fkey`    FOREIGN KEY (`movementId`) REFERENCES `Movement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `MovementItem` ADD CONSTRAINT `MovementItem_productId_fkey`     FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Client`       ADD CONSTRAINT `Client_companyId_fkey`           FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
