/* eslint-disable no-console */
const builder = require('electron-builder');
const path = require('path');
const fs = require('fs-extra');

const { Arch, Platform } = builder;

const BUILD_RESOURCES_DIR_NAME = 'build-resources-mas';

console.log(`Machine: ${process.platform}`);

let targets;
switch (process.platform) {
  case 'darwin': {
    targets = Platform.MAC.createTarget(['mas'], Arch.universal);
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
    appId: 'com.singlebox.app',
    productName: 'Singlebox',
    asar: true,
    files: [
      '!docs/**/*',
      '!template/**/*',
      '!patches/**/*',
      '!template*.zip',
      '!template*.json',
      // heavy demo files
      '!node_modules/image-q/demo/**/*',
      // other files
      '!**/*/*.ts',
      '!node_modules/*/*.map',
      '!**/*/.DS_Store',
    ],
    asarUnpack: filesToBeReplaced.map((fileName) => path.join('build', fileName)),
    publish: [
      {
        provider: 'github',
        owner: 'webcatalog',
        repo: 'singlebox',
      },
    ],
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
    directories: {
      buildResources: BUILD_RESOURCES_DIR_NAME,
    },
    mas: {
      category: 'public.app-category.productivity',
      entitlements: path.join(BUILD_RESOURCES_DIR_NAME, 'entitlements.mas.plist'),
      entitlementsInherit: path.join(BUILD_RESOURCES_DIR_NAME, 'entitlements.mas.plist'),
      entitlementsLoginHelper: path.join(BUILD_RESOURCES_DIR_NAME, 'entitlements.mas.login-helper.plist'),
      provisioningProfile: path.join(BUILD_RESOURCES_DIR_NAME, 'embedded.provisionprofile'),
      // https://github.com/electron/electron/issues/15958#issuecomment-447685065
      // alternative solution for app.requestSingleInstanceLock in signed mas builds (Mac App Store)
      extendInfo: {
        LSMultipleInstancesProhibited: true,
      },
    },
    afterPack: (context) => {
      console.log('Running afterPack hook....');
      const buildResourcesPath = path.join(__dirname, BUILD_RESOURCES_DIR_NAME);
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
