module.exports = {
  packagerConfig: {
    name: 'Knowledge Pipeline',
    appId: 'com.knowledgepipeline.desktop',
    icon: './src/assets/icon',
    appBundleId: 'com.knowledgepipeline.desktop',
    osxSign: {
      identity: 'Developer ID Application: YOUR NAME (TEAM_ID)',
      'hardened-runtime': true,
      entitlements: './build/entitlements.mac.plist',
      'entitlements-inherit': './build/entitlements.mac.plist',
      'signature-flags': 'library'
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        background: './src/assets/dmg-background.png',
        contents: [
          {
            x: 130,
            y: 220
          },
          {
            x: 410,
            y: 220,
            type: 'link',
            path: '/Applications'
          }
        ]
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.tsx',
              name: 'main_window'
            }
          ]
        }
      }
    }
  ]
};