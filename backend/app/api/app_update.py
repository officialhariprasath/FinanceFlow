"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API (or edit + restart).
# apkUrl must be a direct download link (GitHub Release asset works well).
APP_UPDATE = {
    "versionCode": 4,
    "versionName": "1.2.1",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.1/FinanceFlow.apk",
    "notes": "Modal fixes, email/phone login, forgot password, registration OTP verification.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
