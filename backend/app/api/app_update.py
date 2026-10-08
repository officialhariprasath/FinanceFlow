"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 15,
    "versionName": "1.2.12",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.12/FinanceFlow-v1.2.12.apk",
    "notes": "Grace update: last N overdue installments stay free; older/most-late ones get the penalty. Recalculates after payments.",
    "force": True,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
