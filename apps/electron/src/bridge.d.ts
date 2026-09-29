import type { ScanReply } from "./contract"

declare global {
  interface Window {
    localMusic: {
      chooseFolder: () => Promise<ScanReply>
      isDevelopment: boolean
    }
  }
}
