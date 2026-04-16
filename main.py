import os
import uuid

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

staff_db = []
token_store = {}


class StaffCreate(BaseModel):
    name: str
    role: str
    email: str | None = None
    phone: str


class SetPassword(BaseModel):
    token: str
    password: str


def send_sms(phone: str, message: str):
    api_key = os.getenv("FAST2SMS_API_KEY")
    if not api_key:
        return {"status": "skipped", "reason": "FAST2SMS_API_KEY not configured"}

    response = requests.post(
        "https://www.fast2sms.com/dev/bulkV2",
        json={
            "message": message,
            "language": "english",
            "route": "v3",
            "numbers": phone,
        },
        headers={
            "authorization": api_key,
            "Content-Type": "application/json",
        },
        timeout=20,
    )

    response.raise_for_status()
    return {"status": "sent"}


@app.post("/create-staff")
def create_staff(data: StaffCreate):
    employee_id = data.role[:3].upper() + str(len(staff_db) + 100)
    token = str(uuid.uuid4())

    new_user = {
        "name": data.name,
        "role": data.role,
        "email": data.email,
        "phone": data.phone,
        "employee_id": employee_id,
        "password": None,
    }

    staff_db.append(new_user)
    token_store[token] = employee_id

    setup_link = f"http://localhost:5173/setup-password?token={token}"
    send_result = send_sms(data.phone, f"MedConnect: Set password {setup_link}")

    return {
        "message": "Staff created",
        "employee_id": employee_id,
        "setup_link": setup_link,
        "credential_delivery": send_result,
    }


@app.post("/set-password")
def set_password(data: SetPassword):
    if data.token not in token_store:
        return {"error": "Invalid or expired token"}

    employee_id = token_store[data.token]

    for user in staff_db:
        if user["employee_id"] == employee_id:
            user["password"] = data.password

    del token_store[data.token]

    return {"message": "Password set successfully"}
