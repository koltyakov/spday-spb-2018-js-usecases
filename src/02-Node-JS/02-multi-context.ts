import { sp, Web } from '@pnp/sp';

import { auth } from './utils/auth';
import { enviromnets } from '../../scripts/env';

(async () => {

  const runLogic = async (siteUrl: string): Promise<void> => {
    const web = new Web(siteUrl).configure({
      headers: {
        Accept: 'application/json;odata=nometadata'
      }
    });
    const { Title: WebTitle, ServerRelativeUrl } = await web.select('Title,ServerRelativeUrl').get();
    const { Title: UserName } = await sp.web.currentUser.select('Title').get();
    console.log({ ServerRelativeUrl, WebTitle, UserName });
  };

  // Reaches different environments using different credentials
  for (const env in enviromnets) {
    if (env !== 'default') {
      console.log(`\n=== Target: ${enviromnets[env].title} ===\n`);
      const siteUrl = await auth(enviromnets[env].configPath);
      await runLogic(siteUrl);
    }
  }

  console.log('\n');

})()
  .catch(({ message }) => console.error(message));
