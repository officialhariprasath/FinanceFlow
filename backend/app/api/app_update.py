"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 10,
    "versionName": "1.2.7",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.7/FinanceFlow-v1.2.7.apk",
    "notes": "Collections page now uses the same Record Payment flow as Loans — pick installment dates, see allocation preview.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
