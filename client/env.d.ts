/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_HOST?: string;
  readonly VITE_DISCORD_CLIENT_ID?: string;
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 