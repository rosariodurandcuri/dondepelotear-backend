-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'F6';

-- AlterTable
ALTER TABLE "fields" ADD COLUMN     "courts" INTEGER,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priceMax" DECIMAL(10,2),
ADD COLUMN     "source" TEXT,
ADD COLUMN     "surface" TEXT,
ALTER COLUMN "pricePerHour" DROP NOT NULL;

