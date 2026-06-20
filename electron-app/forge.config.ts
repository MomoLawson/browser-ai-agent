import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDMG } from '@electron-forge/maker-dmg'
import { MakerZIP } from '@electron-forge/maker-zip'

const config: ForgeConfig = {
  packagerConfig: {
    name: 'BAI Desktop',
    executableName: 'bai-desktop',
    icon: './resources/icon',
  },
  makers: [
    new MakerDMG({}, ['darwin']),
    new MakerZIP({}, ['darwin', 'win32']),
  ],
}

export default config
