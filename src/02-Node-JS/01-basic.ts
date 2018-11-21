// import { sp } from '@pnp/sp';
// import { taxonomy } from '@pnp/sp-taxonomy';
import { Logger, LogLevel, ConsoleListener } from '@pnp/logging';

import { auth } from './utils/auth';

Logger.subscribe(new ConsoleListener());
Logger.activeLogLevel = LogLevel.Error;

(async () => {

  await auth();
  require('../01-Console/01-rest'); // Reusing client side logic AS IS

})()
  .catch(({ message }) => console.error(message));
