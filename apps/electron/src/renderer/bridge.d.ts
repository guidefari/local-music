import type { ScanReply } from "../shared/library-contract"

declare global {
  interface Window {
    localMusic: {
      chooseFolder: () => Promise<ScanReply>
      isDevelopment: boolean
    }
  }
}
