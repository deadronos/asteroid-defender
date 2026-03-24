/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
