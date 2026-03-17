from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth_admin import ADMIN_USERNAME, ADMIN_PASSWORD, create_token, revoke_token, get_admin_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"token": create_token()}


@router.post("/logout")
def logout(token: str = Depends(get_admin_token)):
    revoke_token(token)
    return {"ok": True}


@router.get("/me")
def me(token: str = Depends(get_admin_token)):
    return {"username": ADMIN_USERNAME}
