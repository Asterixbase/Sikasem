"""
MTN MoMo service — STUB implementation.
Wire in real MoMo API when credentials are available.
All functions return simulated success responses.
"""
import logging
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)


async def request_to_pay(
    amount_pesawas: int,
    phone_e164: str,
    reference: str,
    note: str = "Sikasem payment",
) -> dict:
    """
    Initiate a MoMo RequestToPay (collect from customer).
    TODO: Wire to real MTN MoMo Collections API when MOMO_* env vars are set.
    """
    logger.info(
        "STUB MoMo collect — amount=%d pesawas, phone=%s, ref=%s",
        amount_pesawas,
        phone_e164,
        reference,
    )
    external_ref = str(uuid.uuid4())
    return {
        "status": "pending",
        "external_ref": external_ref,
        "message": "Payment request sent to customer",
    }


async def transfer(
    amount_pesawas: int,
    recipient_phone: str,
    network: str,
    note: str = "Sikasem payout",
) -> dict:
    """
    Send money to a phone number (Disbursement).
    TODO: Wire to real MTN MoMo Disbursements API when MOMO_* env vars are set.
    """
    logger.info(
        "STUB MoMo payout — amount=%d pesawas, phone=%s, network=%s",
        amount_pesawas,
        recipient_phone,
        network,
    )
    # Fee: 1% capped at 500 pesawas (~GHS 5)
    fee = min(int(amount_pesawas * 0.01), 500)
    return {
        "payout_id": str(uuid.uuid4()),
        "status": "success",
        "recipient_name": None,
        "amount_pesawas": amount_pesawas,
        "fee_pesawas": fee,
        "external_ref": str(uuid.uuid4()),
    }
