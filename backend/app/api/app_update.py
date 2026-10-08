"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 16,
    "versionName": "1.2.13",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.13/FinanceFlow-v1.2.13.apk",
    "notes": "Penalty income lifecycle: Owner Account shows principal / profit / penalty separately. Settlements no longer mix late fees into profit. Collections & Capital show penalty with agents.",
    "force": True,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
