"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 11,
    "versionName": "1.2.8",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.8/FinanceFlow-v1.2.8.apk",
    "notes": "Partial payments: pay less than selected days (e.g. ₹200 of ₹240) — fills oldest days first, leaves balance pending.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
