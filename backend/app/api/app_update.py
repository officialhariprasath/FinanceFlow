"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 17,
    "versionName": "1.2.14",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.14/FinanceFlow-v1.2.14.apk",
    "notes": "Calendar-day grace from today; last due accumulates post-maturity penalty. Loan schedule shows paid total with penalty and Paid on date.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
