//@ts-check

const { config } = require('./utils');
const { enviromnets } = require('./env');

(async () => {

  for (const env in enviromnets) {
    console.log(`\n=== Target: ${enviromnets[env].title} ===\n`);
    await config(enviromnets[env].configPath);
  }

})();
