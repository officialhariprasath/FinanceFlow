"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 18,
    "versionName": "1.2.15",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.15/FinanceFlow-v1.2.15.apk",
    "notes": "Loans UX: live name search, KPIs, collected totals (principal+interest+penalties), mobile cards, credit score on new loan/detail, mark default/write-off on detail, schedule jump/filter. CIBIL-style score + contiguous band settings.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
