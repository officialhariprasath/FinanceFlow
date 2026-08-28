"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 9,
    "versionName": "1.2.6",
    "apkUrl": "https://finance-flow-rho-ten.vercel.app/releases/FinanceFlow-v1.2.6.apk",
    "notes": "Fix repeated update popup — Later snoozes for 24 hours. Update once to stop the loop.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
