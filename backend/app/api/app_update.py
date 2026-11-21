"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 20,
    "versionName": "1.2.17",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.17/FinanceFlow-v1.2.17.apk",
    "notes": "Customer UX overhaul: ledger tabs, credit score gauge + factors, borrower form settings, split address, desktop add/edit pages, New Borrower flow, payment history dropdown.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
