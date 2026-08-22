"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API (or edit + restart).
# apkUrl must be a direct download link (GitHub Release asset works well).
APP_UPDATE = {
    "versionCode": 3,
    "versionName": "1.2.0",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/1.2.1/FinanceFlow-v1.2.0.apk",
    "notes": "Full FinanceFlow app with in-app updates and device backup.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
