import { Web } from '@pnp/sp';

import { auth } from './utils/auth';

(async () => {

  const siteUrl = await auth();

  const listTitle = 'MyCustomList';
  const itemsToCreate = Array.apply(null, Array(50)).map((_, i) => {
    return {
      Title: `Item ${i}`
    };
  });

  const web = new Web(siteUrl).configure({
    headers: {
      Accept: 'application/json;odata=nometadata'
    }
  });

  const lists = await web.lists.select('Title').filter(`Title eq '${listTitle}'`).get();
  if (lists.length === 0) {
    await web.lists.add(listTitle);
  }

  const list = web.lists.getByTitle(listTitle);
  const entity = await list.getListItemEntityTypeFullName();
  const batch = web.createBatch();

  await list.select('ItemCount').get().then(({ ItemCount }) => console.log(`Items in a list before: ${ItemCount}`));

  for (const itemPayload of itemsToCreate) {
    list.items.inBatch(batch).add(itemPayload, entity);
  }

  await batch.execute();

  await list.select('ItemCount').get().then(({ ItemCount }) => console.log(`Items in a list after: ${ItemCount}`));

})()
  .catch(({ message }) => console.error(message));
