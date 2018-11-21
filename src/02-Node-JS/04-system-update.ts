import { sp, List } from '@pnp/sp';

import { auth } from './utils/auth';
import { systemUpdate } from './utils/systemUpdate';
import { enviromnets } from '../../scripts/env';

(async () => {

  await auth(enviromnets.sysUpdate.configPath);

  const currentUser = await sp.web.currentUser.select('Id,Title').get();
  console.log(`\nCurrent user: ${currentUser.Title} (ID: ${currentUser.Id})`);

  const list = sp.web.lists.getByTitle('MyCustomList');
  let items = await getRecentItems(list);

  console.log(`\nItems metadata before:`);
  console.table(items, ['Id', 'Title', 'EditorId', 'Modified', 'OData__UIVersionString']);

  for (const item of items) {
    await systemUpdate(list.items.getById(item.Id), [
      { FieldName: 'Title', FieldValue: new Date().toISOString() }
    ]);
  }

  items = await getRecentItems(list);

  console.log(`\nItems metadata after:`);
  console.table(items, ['Id', 'Title', 'EditorId', 'Modified', 'OData__UIVersionString']);

})()
  .catch(({ message }) => console.error(message));

const getRecentItems = (list: List): Promise<{ Id: number; Title: string; [key: string]: any }[]> => {
  return list.items
    .select('Id,Title,EditorId,Modified,OData__UIVersionString')
    .orderBy('Id', false).top(5).get();
};
