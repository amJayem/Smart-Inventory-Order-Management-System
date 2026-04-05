-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "shippingAddress" JSONB;
