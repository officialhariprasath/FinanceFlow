"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 13,
    "versionName": "1.2.10",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.10/FinanceFlow-v1.2.10.apk",
    "notes": "Advance payments: pay more than today and extra applies to next day(s). Shows allocation preview and installment schedule.",
    "force": True,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
