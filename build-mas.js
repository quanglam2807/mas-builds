/* eslint-disable header/header */
/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const builder = require('electron-builder');
const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const del = require('del');

const packageJson = require('./package.json');
const configJson = require('./config.json');

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

const packageJsonPath = path.join(__dirname, 'package.json');
const packageJsonContent = fs.readJSONSync(packageJsonPath);
packageJsonContent.name = configJson.productName;
fs.writeJSONSync(packageJsonPath, packageJsonContent, { spaces: '  ' });

const protocols = [];
if (configJson.setAsDefaultBrowser) {
  protocols.push({
    name: 'HTTPS Protocol',
    schemes: ['https'],
  });
  protocols.push({
    name: 'HTTP Protocol',
    schemes: ['http'],
  });
}
if (configJson.setAsDefaultEmailClient) {
  protocols.push({
    name: 'Mailto Protocol',
    schemes: ['mailto'],
  });
}

const opts = {
  targets,
  config: {
    asarUnpack: [
      'node_modules/node-mac-permissions/build',
      'node_modules/keytar/build',
    ],
    appId: configJson.productId,
    // https://github.com/electron-userland/electron-builder/issues/3730
    buildVersion: process.platform === 'darwin' ? appVersion : undefined,
    productName: configJson.productName,
    files: [
      '!docs/**/*',
      '!popclip/**/*',
      '!test/**/*',
    ],
    directories: {
      buildResources: 'build-resources-mas',
    },
    protocols,
    mac: {
      darkModeSupport: true,
      // https://github.com/electron/electron/issues/15958#issuecomment-447685065
      // alternative solution for app.requestSingleInstanceLock in signed mas builds (Mac App Store)
      extendInfo: {
        LSMultipleInstancesProhibited: true,
        // NSLocationUsageDescription: '',
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
      const resourcesDirPath = path.join(context.appOutDir, `${configJson.productName}.app`, 'Contents', 'Resources');
      return Promise.resolve()
        .then(() => new Promise((resolve, reject) => {
          // deleted unused lproj files
          // so support languages are displayed correctly on Mac App Store
          const languages = ['en'];

          if (process.platform === 'darwin') {
            glob(path.join(resourcesDirPath, `!(${languages.join('|').replace(/-/g, '_')}).lproj`), (err, files) => {
              console.log('Deleting redundant *.lproj files...');
              if (err) return reject(err);
              return del(files).then(() => {
                files.forEach((file) => {
                  console.log('Deleted', path.basename(file));
                });
                resolve();
              }, reject);
            });
          } else {
            resolve();
          }
        }))
        .then(() => {
          console.log(`Configured ${configJson.productName} successfully.`);
        });
    },
    publish: [{
      provider: 'github',
      repo: 'mas-builds',
      owner: 'webcatalog',
    }],
  },
};

if (configJson.allowCamera) {
  opts.config.mac.extendInfo.NSCameraUsageDescription = `The websites you are running request to access your camera. ${configJson.productName} itself does not utilize your camera by any means.`;
}

if (configJson.allowMicrophone) {
  opts.config.mac.extendInfo.NSCameraUsageDescription = `The websites you are running request to access your microphone. ${configJson.productName} itself does not utilize your microphone by any means.`;
}

Promise.resolve()
  .then(() => {
    const buildResourcesPath = path.join(__dirname, 'build-resources-mas');
    const filesToBeReplaced = fs.readdirSync(path.join(buildResourcesPath, 'build'));

    const p = filesToBeReplaced.map((fileName) => fs.copyFile(
      path.join(buildResourcesPath, 'build', fileName),
      path.join(__dirname, 'build', fileName),
    ));
    return Promise.all(p);
  })
  .then(() => builder.build(opts))
  .then(() => {
    console.log('build successful');
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
