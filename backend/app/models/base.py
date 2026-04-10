# Import all models here so SQLAlchemy registers them with Base.metadata
from app.models.user import User, OtpCode, ShopMember  # noqa: F401
from app.models.shop import Shop, TaxProfile  # noqa: F401
from app.models.product import Category, Product, PriceHistory  # noqa: F401
from app.models.sale import Sale, SaleItem  # noqa: F401
from app.models.credit import CreditCustomer, CreditSale, CreditSaleItem, CreditCollection  # noqa: F401
from app.models.inventory import StockMovement  # noqa: F401
from app.models.tax import TaxInvoice  # noqa: F401
from app.models.vault import VaultPayout  # noqa: F401
from app.models.notification import PushToken  # noqa: F401
