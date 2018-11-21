import { graph } from '@pnp/graph';

declare const window;

(async () => {

  // Microsoft Graph API sample: getting Office 365 Groups
  const { moduleLoaderPromise } = window || {} as any;
  if (moduleLoaderPromise) { // We're on a Modern page
    const { context: spfxContext } = await moduleLoaderPromise;
    graph.setup({ spfxContext }); // Configure MS Graph API with SPFx context tokens
    const groups = await graph.groups.select('id', 'displayName', 'createdDateTime').get();
    console.log('\n=== Groups ===');
    console.table(groups, ['id', 'displayName', 'createdDateTime']);
  } else {
    console.error('Graph API is inaccessible');
  }

})()
  .catch(({ message }) => console.error(message));
