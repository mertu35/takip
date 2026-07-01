/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_SEED_SYSADMIN_EMAIL?: string;
  readonly VITE_SEED_SYSADMIN_PASSWORD?: string;
  readonly VITE_SEED_SALES_EMAIL?: string;
  readonly VITE_SEED_SALES_PASSWORD?: string;
  readonly VITE_SEED_ACCOUNTING_EMAIL?: string;
  readonly VITE_SEED_ACCOUNTING_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
