import type { ScanReply } from '../../contracts/library'

declare global {
  interface Window {
    localMusic: {
      chooseFolder: () => Promise<ScanReply>
      isDevelopment: boolean
    }
  }
}
