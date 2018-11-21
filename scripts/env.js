//@ts-check

const { join } = require('path');

const enviromnets = {
  default: {
    title: 'Default',
    configPath: undefined // default path
  },
  sysUpdate: {
    title: 'System Update demo',
    configPath: join(process.cwd(), './config/private.sysUpdate.json')
  },
  env1: {
    title: 'Environment 1',
    configPath: join(process.cwd(), './config/private.env1.json')
  },
  env2: {
    title: 'Environment 2',
    configPath: join(process.cwd(), './config/private.env2.json')
  },
  addin: {
    title: 'Add-In Only Permissions',
    configPath: join(process.cwd(), './config/private.addin.json')
  }
};

module.exports = { enviromnets };
