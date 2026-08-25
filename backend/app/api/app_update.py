"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 7,
    "versionName": "1.2.4",
    "apkUrl": "https://finance-flow-rho-ten.vercel.app/releases/FinanceFlow-v1.2.4.apk",
    "notes": "Fix: consistent APK signing so in-app updates install cleanly. Also includes collections overdue/to-collect-now and Edit Loan live calc.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
