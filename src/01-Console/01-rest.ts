import { sp } from '@pnp/sp';
import { taxonomy } from '@pnp/sp-taxonomy';

(async () => {

  // Configure web to use specific headers
  const web = sp.web.configure({
    headers: {
      Accept: 'application/json;odata=nometadata'
    }
  });

  // Getting current user information
  const currentUser = await web.currentUser.select('Title', 'LoginName')
    .get<{ Title: string; LoginName: string }>();
  console.log('\nCurrent user info:', currentUser);

  // Getting current web information
  const webInfo = await web.select('Id', 'Title', 'Created', 'ResourcePath').get();
  console.log('\nCurrent web info:', webInfo);

  // Getting current web's none hidden lists
  const lists = await web.lists
    .select('*,RootFolder/ServerRelativeUrl')
    .filter('Hidden eq false')
    .expand('RootFolder')
    .get().then(lists => lists.map(list => ({
      ...list,
      'RootFolder/ServerRelativeUrl': list.RootFolder.ServerRelativeUrl
    })));
  console.log('\n=== Lists ===');
  console.table(lists, ['Id', 'Title', 'BaseTemplate', 'ItemCount', 'ContentTypesEnabled', 'RootFolder/ServerRelativeUrl']);

  // Managed Metadata consumption Sample

  // Getting Term Sets in People Term Group
  const peopleGroup = await taxonomy.getDefaultSiteCollectionTermStore()
    .getTermGroupById('9dd47937-e620-4196-87a7-815c7e6aa384').get();
  const termSets = await peopleGroup.termSets.select('Id', 'Name', 'LastModifiedDate').get();
  console.log('\n=== MMD: Term Sets in People Term Group ===');
  console.table(termSets, ['Id', 'Name', 'LastModifiedDate']);

  // Getting active Department Terms
  const depertmentTerms = await peopleGroup.termSets.getByName('Department').terms
    .select('Id', 'Name', 'PathOfTerm', 'IsDeprecated', 'IsAvailableForTagging').get()
    .then(departments => departments.filter(d => d.IsAvailableForTagging && !d.IsDeprecated));
  console.log('\n=== MMD: Department Terms ===');
  console.table(depertmentTerms, ['Id', 'Name', 'PathOfTerm']);

})()
  .catch(({ message }) => console.error(message));
