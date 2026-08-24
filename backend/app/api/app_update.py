"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 5,
    "versionName": "1.2.2",
    "apkUrl": "https://finance-flow-rho-ten.vercel.app/releases/FinanceFlow-v1.2.2.apk",
    "notes": "Agent create/edit permissions for loans and customers.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
