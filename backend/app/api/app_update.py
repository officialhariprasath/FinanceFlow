"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 14,
    "versionName": "1.2.11",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.11/FinanceFlow-v1.2.11.apk",
    "notes": "Fix: settling by selecting all pending/advance days (e.g. ₹4560) no longer fails. Advance & partial payments included.",
    "force": True,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
