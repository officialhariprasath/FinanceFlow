import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";

import { getCustomers } from "./customerService";
import { getLoans } from "./loanService";
import { getLoanPayments } from "./paymentService";
import { getTodayCollections } from "./collectionService";
import { getCapitalSummary, getCapitalTransactions } from "./capitalService";
import { getLoanRenewals } from "./renewalService";
import api from "../api/axios";

const BACKUP_META_KEY = "ff_backup_meta";
const BACKUP_DATA_KEY = "ff_backup_payload";
const BACKUP_DIR = "FinanceFlowBackups";
const LATEST_FILE = "latest-backup.json";

export type DeviceBackupPayload = {
  version: 1;
  exported_at: string;
  device_platform: string;
  session_hint?: string;
  customers: unknown[];
  customer_names: { id: number; full_name: string }[];
  loans: unknown[];
  payments: unknown[];
  renewals: unknown[];
  collections: unknown;
  capital_summary: unknown;
  capital_transactions: unknown;
};

export type BackupMeta = {
  exported_at: string;
  file_path?: string;
  uri?: string;
  counts: {
    customers: number;
    loans: number;
    payments: number;
    renewals: number;
  };
};

async function gatherBackupData(sessionHint?: string): Promise<DeviceBackupPayload> {
  const [customers, loans, collections, namesRes] = await Promise.all([
    getCustomers().catch(() => []),
    getLoans().catch(() => []),
    getTodayCollections().catch(() => null),
    api
      .get<{ id: number; full_name: string }[]>("/customers/names")
      .then((r) => r.data)
      .catch(() => [] as { id: number; full_name: string }[]),
  ]);

  let capital_summary: unknown = null;
  let capital_transactions: unknown = [];
  try {
    capital_summary = await getCapitalSummary();
    capital_transactions = (await getCapitalTransactions()).transactions ?? [];
  } catch {
    // Agents may lack capital permission — skip.
  }

  const paymentChunks = await Promise.all(
    loans.map(async (loan) => {
      try {
        const pmts = await getLoanPayments(loan.id);
        return pmts.map((p) => ({
          ...p,
          loan_id: loan.id,
          customer_id: loan.customer_id,
        }));
      } catch {
        return [];
      }
    })
  );
  const payments = paymentChunks.flat();

  const renewalChunks = await Promise.all(
    loans.map(async (loan) => {
      try {
        const rows = await getLoanRenewals(loan.id);
        return rows.map((r) => ({ ...r, loan_id: loan.id, customer_id: loan.customer_id }));
      } catch {
        return [];
      }
    })
  );
  const renewals = renewalChunks.flat();

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    device_platform: Capacitor.getPlatform(),
    session_hint: sessionHint,
    customers,
    customer_names: namesRes,
    loans,
    payments,
    renewals,
    collections,
    capital_summary,
    capital_transactions,
  };
}

async function ensureBackupDir(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: BACKUP_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    // Directory may already exist.
  }
}

/**
 * Pull live data from the API and store a full JSON backup on the device.
 * Uses app Data directory (survives while the app is installed) + Preferences cache.
 *
 * @param options.download  Web only: trigger a browser file download (Settings → Backup).
 *                          Default false — never auto-download on login.
 */
export async function createDeviceBackup(
  sessionHint?: string,
  options?: { download?: boolean }
): Promise<BackupMeta> {
  const payload = await gatherBackupData(sessionHint);
  const json = JSON.stringify(payload, null, 2);

  await Preferences.set({ key: BACKUP_DATA_KEY, value: json });

  let file_path: string | undefined;
  let uri: string | undefined;

  if (Capacitor.isNativePlatform()) {
    await ensureBackupDir();
    const stamped = `backup-${payload.exported_at.replace(/[:.]/g, "-")}.json`;
    const latestPath = `${BACKUP_DIR}/${LATEST_FILE}`;
    const stampPath = `${BACKUP_DIR}/${stamped}`;

    const written = await Filesystem.writeFile({
      path: latestPath,
      data: json,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    await Filesystem.writeFile({
      path: stampPath,
      data: json,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    file_path = latestPath;
    uri = written.uri;
  } else if (options?.download) {
    // Explicit user action in Settings only — never on login/auto.
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeflow-backup-${payload.exported_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const meta: BackupMeta = {
    exported_at: payload.exported_at,
    file_path,
    uri,
    counts: {
      customers: payload.customers.length,
      loans: payload.loans.length,
      payments: payload.payments.length,
      renewals: payload.renewals.length,
    },
  };
  await Preferences.set({ key: BACKUP_META_KEY, value: JSON.stringify(meta) });
  return meta;
}

export async function getBackupMeta(): Promise<BackupMeta | null> {
  const { value } = await Preferences.get({ key: BACKUP_META_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as BackupMeta;
  } catch {
    return null;
  }
}

/** Read the cached backup from Preferences (fast, works offline). */
export async function readCachedBackup(): Promise<DeviceBackupPayload | null> {
  const { value } = await Preferences.get({ key: BACKUP_DATA_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as DeviceBackupPayload;
  } catch {
    return null;
  }
}

/** Read the on-disk latest backup file (native only). */
export async function readDiskBackup(): Promise<DeviceBackupPayload | null> {
  if (!Capacitor.isNativePlatform()) return readCachedBackup();
  try {
    const file = await Filesystem.readFile({
      path: `${BACKUP_DIR}/${LATEST_FILE}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const raw = typeof file.data === "string" ? file.data : "";
    return JSON.parse(raw) as DeviceBackupPayload;
  } catch {
    return readCachedBackup();
  }
}

/** Share / export the latest backup so the user can copy it to Drive, Files, etc. */
export async function shareLatestBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const cached = await readCachedBackup();
    if (!cached) throw new Error("No backup on this device yet.");
    const json = JSON.stringify(cached, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeflow-backup-${cached.exported_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  let uri: string | undefined;
  try {
    const result = await Filesystem.getUri({
      path: `${BACKUP_DIR}/${LATEST_FILE}`,
      directory: Directory.Data,
    });
    uri = result.uri;
  } catch {
    // Ensure a file exists first.
    await createDeviceBackup();
    const result = await Filesystem.getUri({
      path: `${BACKUP_DIR}/${LATEST_FILE}`,
      directory: Directory.Data,
    });
    uri = result.uri;
  }

  await Share.share({
    title: "FinanceFlow backup",
    text: "Local FinanceFlow data backup",
    url: uri,
    dialogTitle: "Save or share backup",
  });
}
