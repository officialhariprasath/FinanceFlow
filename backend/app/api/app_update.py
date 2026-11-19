"""
Public app update manifest for the Android APK in-app updater.
"""

from fastapi import APIRouter

router = APIRouter(tags=["App Update"])

# Bump these when you publish a new APK, then redeploy the API.
# Prefer a direct HTTPS APK URL (Vercel /releases or GitHub Release asset).
APP_UPDATE = {
    "versionCode": 19,
    "versionName": "1.2.16",
    "apkUrl": "https://github.com/officialhariprasath/FinanceFlow/releases/download/v1.2.16/FinanceFlow-v1.2.16.apk",
    "notes": "Record Payment: due/penalty/both collect modes, preview penalty fix, checkbox selection sync. Settings sidebar + dedicated notifications page. Customer/loan IDs with VMFC/VMFL prefixes.",
    "force": False,
}


@router.get("/app/update")
def get_app_update():
    return APP_UPDATE
