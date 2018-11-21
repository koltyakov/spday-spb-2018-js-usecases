//@ts-check

const { AuthConfig } = require('node-sp-auth-config');
const { getAuth } = require('node-sp-auth');

const config = (/** @type string */configPath) => {
  return new AuthConfig({
    forcePrompts: true,
    configPath
  })
    .getContext()
    .then(context => {
      console.log(`\n=== Context is configured ===\n`);
      console.log(`SharePoint site URL:     ${context.siteUrl}`);
      console.log(`Authentication strategy: ${context.strategy}`);
      console.log(`\nTesting authentication...`);
      return getAuth(context.siteUrl, context.authOptions);
    })
    .then(_ => {
      console.log(`Successfully authenticated.`);
    })
    .catch(({ message }) => console.error(message));
};

module.exports = { config };
