"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('phone_e164', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('phone_e164'),
    )

    op.create_table('shops',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('location', sa.String(300), nullable=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('owner_id', UUID(as_uuid=False), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('shop_members',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('user_id', UUID(as_uuid=False), nullable=False),
        sa.Column('role', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('otp_codes',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('phone_e164', sa.String(20), nullable=False),
        sa.Column('code_hash', sa.String(128), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_otp_codes_phone_e164', 'otp_codes', ['phone_e164'])

    op.create_table('tax_profiles',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('tin', sa.String(20), nullable=True),
        sa.Column('vat_reg_no', sa.String(20), nullable=True),
        sa.Column('period_type', sa.String(10), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('shop_id'),
    )

    op.create_table('categories',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('parent_id', UUID(as_uuid=False), nullable=True),
        sa.ForeignKeyConstraint(['parent_id'], ['categories.id']),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('products',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('barcode', sa.String(100), nullable=True),
        sa.Column('sku', sa.String(20), nullable=False),
        sa.Column('emoji', sa.String(10), nullable=True),
        sa.Column('category_id', UUID(as_uuid=False), nullable=True),
        sa.Column('buy_price_pesawas', sa.Integer(), nullable=True),
        sa.Column('sell_price_pesawas', sa.Integer(), nullable=True),
        sa.Column('current_stock', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_products_shop_id', 'products', ['shop_id'])
    op.create_index('ix_products_barcode', 'products', ['barcode'])

    op.create_table('price_history',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('product_id', UUID(as_uuid=False), nullable=False),
        sa.Column('supplier_name', sa.String(200), nullable=True),
        sa.Column('unit_cost_pesawas', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('sales',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('reference', sa.String(30), nullable=False),
        sa.Column('total_pesawas', sa.Integer(), nullable=False),
        sa.Column('payment_method', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reference'),
    )
    op.create_index('ix_sales_shop_id', 'sales', ['shop_id'])
    op.create_index('ix_sales_created_at', 'sales', ['created_at'])

    op.create_table('sale_items',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('sale_id', UUID(as_uuid=False), nullable=False),
        sa.Column('product_id', UUID(as_uuid=False), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price_pesawas', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('stock_movements',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('product_id', UUID(as_uuid=False), nullable=False),
        sa.Column('movement_type', sa.String(20), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_cost_pesawas', sa.Integer(), nullable=True),
        sa.Column('adjustment_sign', sa.String(1), nullable=True),
        sa.Column('reason', sa.String(50), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('credit_customers',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('id_type', sa.String(30), nullable=True),
        sa.Column('id_number', sa.String(50), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('momo_phone', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('credit_sales',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=False), nullable=False),
        sa.Column('reference', sa.String(30), nullable=False),
        sa.Column('amount_pesawas', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('momo_queued_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['credit_customers.id']),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reference'),
    )

    op.create_table('credit_sale_items',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('credit_sale_id', UUID(as_uuid=False), nullable=False),
        sa.Column('product_id', UUID(as_uuid=False), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price_pesawas', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['credit_sale_id'], ['credit_sales.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('credit_collections',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('credit_sale_id', UUID(as_uuid=False), nullable=False),
        sa.Column('amount_pesawas', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('network', sa.String(10), nullable=True),
        sa.Column('external_ref', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['credit_sale_id'], ['credit_sales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('tax_invoices',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('period', sa.String(7), nullable=False),
        sa.Column('invoice_type', sa.String(10), nullable=False),
        sa.Column('vendor_name', sa.String(200), nullable=False),
        sa.Column('vendor_tin', sa.String(20), nullable=True),
        sa.Column('invoice_number', sa.String(50), nullable=False),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('total_amount_pesawas', sa.Integer(), nullable=True),
        sa.Column('taxable_amount_pesawas', sa.Integer(), nullable=True),
        sa.Column('vat_amount_pesawas', sa.Integer(), nullable=True),
        sa.Column('nhil_amount_pesawas', sa.Integer(), nullable=True),
        sa.Column('getfund_amount_pesawas', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tax_invoices_shop_id', 'tax_invoices', ['shop_id'])
    op.create_index('ix_tax_invoices_period', 'tax_invoices', ['period'])

    op.create_table('vault_payouts',
        sa.Column('id', UUID(as_uuid=False), nullable=False),
        sa.Column('shop_id', UUID(as_uuid=False), nullable=False),
        sa.Column('amount_pesawas', sa.Integer(), nullable=False),
        sa.Column('recipient_phone', sa.String(20), nullable=False),
        sa.Column('recipient_name', sa.String(200), nullable=True),
        sa.Column('network', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('fee_pesawas', sa.Integer(), nullable=True),
        sa.Column('external_ref', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('vault_payouts')
    op.drop_table('tax_invoices')
    op.drop_table('credit_collections')
    op.drop_table('credit_sale_items')
    op.drop_table('credit_sales')
    op.drop_table('credit_customers')
    op.drop_table('stock_movements')
    op.drop_table('sale_items')
    op.drop_table('sales')
    op.drop_table('price_history')
    op.drop_table('products')
    op.drop_table('categories')
    op.drop_table('tax_profiles')
    op.drop_table('otp_codes')
    op.drop_table('shop_members')
    op.drop_table('shops')
    op.drop_table('users')
