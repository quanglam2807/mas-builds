/* eslint-disable header/header */
/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const builder = require('electron-builder');
const path = require('path');
const fs = require('fs-extra');

const packageJson = require('./package.json');

const { Arch, Platform } = builder;

console.log(`Machine: ${process.platform}`);

const appVersion = packageJson.version;

let targets;
switch (process.platform) {
  case 'darwin': {
    targets = Platform.MAC.createTarget([process.env.FORCE_DEV ? 'mas-dev' : 'mas'], Arch.universal);
    break;
  }
  default: {
    console.log('Platform is not supported');
    process.exit(1);
  }
}

const filesToBeReplaced = fs.readdirSync(path.join(__dirname, 'build-resources-mas', 'build'));

const packageJsonPath = path.join(__dirname, 'package.json');
const packageJsonContent = fs.readJSONSync(packageJsonPath);
packageJsonContent.name = 'Singlebox';
fs.writeJSONSync(packageJsonPath, packageJsonContent, { spaces: '  ' });

const opts = {
  targets,
  config: {
    asarUnpack: filesToBeReplaced
      .map((fileName) => path.join('build', fileName))
      .concat([
        'node_modules/node-mac-permissions/build',
        'node_modules/keytar/build',
      ]),
    appId: 'com.webcatalog.singlebox',
    // https://github.com/electron-userland/electron-builder/issues/3730
    buildVersion: process.platform === 'darwin' ? appVersion : undefined,
    productName: 'Singlebox',
    files: [
      '!docs/**/*',
      '!popclip/**/*',
      '!test/**/*',
    ],
    directories: {
      buildResources: 'build-resources-mas',
    },
    protocols: [
      {
        name: 'HTTPS Protocol',
        schemes: ['https'],
      },
      {
        name: 'HTTP Protocol',
        schemes: ['http'],
      },
      {
        name: 'Mailto Protocol',
        schemes: ['mailto'],
      },
    ],
    mac: {
      darkModeSupport: true,
      // https://github.com/electron/electron/issues/15958#issuecomment-447685065
      // alternative solution for app.requestSingleInstanceLock in signed mas builds (Mac App Store)
      extendInfo: {
        LSMultipleInstancesProhibited: true,
        NSCameraUsageDescription: 'Websites you are running request to access your camera. Singlebox itself does not utilize your camera by any means.',
        // NSLocationUsageDescription: 'A website you are running requests to access your location. Singlebox itself does not collect or utilize your location data by any means.',
        NSMicrophoneUsageDescription: 'Websites you are running request to access your microphone. Singlebox itself does not utilize your microphone by any means.',
      },
      entitlementsLoginHelper: 'build-resources-mas/entitlements.mas.login-helper.plist',
    },
    mas: {
      category: 'public.app-category.productivity',
      provisioningProfile: process.env.FORCE_DEV
        ? 'build-resources-mas/embedded-development.provisionprofile' // mas-dev
        : 'build-resources-mas/embedded.provisionprofile',
      darkModeSupport: true,
    },
    afterPack: (context) => {
      console.log('Running afterPack hook....');
      const buildResourcesPath = path.join(__dirname, 'build-resources-mas');
      const resourcesDirPath = path.join(context.appOutDir, 'Singlebox.app', 'Contents', 'Resources');
      const asarUnpackedDirPath = path.join(resourcesDirPath, 'app.asar.unpacked');
      return Promise.resolve()
        .then(() => {
          const p = [];
          filesToBeReplaced.forEach((fileName) => {
            p.push(fs.copyFile(
              path.join(buildResourcesPath, 'build', fileName),
              path.join(asarUnpackedDirPath, 'build', fileName),
            ));
          });
          return Promise.all(p);
        })
        .then(() => {
          console.log('Configured Singlebox successfully.');
        });
    },
    publish: [{
      provider: 'github',
      repo: 'singlebox-mas',
      owner: 'webcatalog',
    }],
  },
};

builder.build(opts)
  .then(() => {
    console.log('build successful');
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
