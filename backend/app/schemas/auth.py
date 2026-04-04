from pydantic import BaseModel


class OtpSendRequest(BaseModel):
    phone: str


class OtpSendResponse(BaseModel):
    sent: bool


class OtpVerifyRequest(BaseModel):
    phone: str
    code: str


class OtpVerifyResponse(BaseModel):
    jwt: str
    expires_at: str  # ISO-8601


class ShopMemberOut(BaseModel):
    user_id: str
    phone: str
    role: str
