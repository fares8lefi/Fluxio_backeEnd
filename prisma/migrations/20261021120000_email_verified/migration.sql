-- AlterTable
ALTER TABLE `User` ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false;

-- Comptes existants : actifs, ou inactifs sans code en attente (suspendus après vérification)
UPDATE `User` SET `email_verified` = true
WHERE `is_active` = true OR (`code` IS NULL AND `code_attempts` = 0);
