-- AlterTable
ALTER TABLE `Product` ADD COLUMN `subcategoryId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(40) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `blurb` VARCHAR(300) NOT NULL DEFAULT '',
    `menuSubtitle` VARCHAR(120) NOT NULL DEFAULT '',
    `menuColumns` INTEGER NOT NULL DEFAULT 2,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_key_key`(`key`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subcategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryId` INTEGER NOT NULL,
    `label` VARCHAR(60) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subcategory_categoryId_sortOrder_idx`(`categoryId`, `sortOrder`),
    UNIQUE INDEX `Subcategory_categoryId_slug_key`(`categoryId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Product_subcategoryId_idx` ON `Product`(`subcategoryId`);

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_subcategoryId_fkey` FOREIGN KEY (`subcategoryId`) REFERENCES `Subcategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subcategory` ADD CONSTRAINT `Subcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Categories move from data/categories.json into the database (same order, labels and blurbs).
INSERT INTO `Category` (`key`, `label`, `slug`, `blurb`, `menuSubtitle`, `menuColumns`, `sortOrder`, `updatedAt`) VALUES
    ('BreakfastDeals', 'Breakfast Deals', 'breakfast-deals', 'Breakfast deals from the shop.', '', 2, 1, CURRENT_TIMESTAMP(3)),
    ('Fried', 'Fried Items', 'fried', 'Samosas, shingara, dal puri, piaju, rolls and more.', '', 2, 2, CURRENT_TIMESTAMP(3)),
    ('Baked', 'Baked Items', 'baked', 'Chicken and beef patties, pies and buns from the oven.', '', 2, 3, CURRENT_TIMESTAMP(3)),
    ('Biscuits', 'Biscuit Items', 'biscuits', 'Shortbread and butter biscuits, sold by the kilo.', 'Priced by weight', 2, 4, CURRENT_TIMESTAMP(3)),
    ('BreadCake', 'Bread & Cake Items', 'bread-cake', 'Buns, cream rolls and cakes.', '', 2, 5, CURRENT_TIMESTAMP(3)),
    ('Kebab', 'Kebab Items', 'kebab', 'Kebab wraps, kebab plates, tandoori chicken and meal deals.', '', 2, 6, CURRENT_TIMESTAMP(3)),
    ('Sweets', 'Sweet Items', 'sweets', 'Rasgulla, rosmalai, laddu and house-made mishti, by the kilo.', 'Priced by weight', 2, 7, CURRENT_TIMESTAMP(3)),
    ('Miscellaneous', 'TV Snacks / Miscellaneous', 'miscellaneous', 'Nimki, snacks and other bits from the shop.', '', 2, 8, CURRENT_TIMESTAMP(3)),
    ('Biriyani', 'Biriani Items', 'biriyani', 'Biriani from the Swiss Bakery kitchen.', '', 2, 9, CURRENT_TIMESTAMP(3)),
    ('Extras', 'Extras', 'extras', 'Sides and add-ons.', '', 2, 10, CURRENT_TIMESTAMP(3)),
    ('SpecialEvening', 'Special - Evening (5.00pm - 9.00pm)', 'special-evening', 'Evening specials, served 5.00pm to 9.00pm.', '', 2, 11, CURRENT_TIMESTAMP(3)),
    ('Drinks', 'Drinks', 'drinks', 'Drinks to go with your order.', '', 2, 12, CURRENT_TIMESTAMP(3)),
    ('HotDrinks', 'Hot Drinks', 'hot-drinks', 'Malai cha, milk tea and ginger tea.', '', 2, 13, CURRENT_TIMESTAMP(3)),
    ('ColdDrinks', 'Cold Drinks', 'cold-drinks', 'Chilled can drinks.', '', 2, 14, CURRENT_TIMESTAMP(3));
