import { sp, Web } from '@pnp/sp';
import { SPFetchClient } from '@pnp/nodejs';

const siteUrl = process.env.SPO_SITE_URL;
const clientId = process.env.SPO_APP_CLIENT_ID;
const clientSecret = process.env.SPO_APP_CLIENT_SECRET;

module.exports = async (context, req): Promise<void> => {

  if (typeof req.body !== 'object') {
    context.res = {
      status: 400,
      body: 'Invalid request object'
    };
    return;
  }

  const SPDayVote: number = ({ up: 1, down: -1 })[(req.body.vote || '').toLowerCase()];
  const SPDayVoteIdentity: string = (req.body.guid || '').toLowerCase();

  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (typeof SPDayVote === 'undefined' || SPDayVoteIdentity.match(guidPattern) === null) {
    context.res = {
      status: 400,
      body: 'Invalid request object'
    };
    return;
  }

  sp.setup({
    sp: {
      fetchClientFactory: () => new SPFetchClient(siteUrl, clientId, clientSecret),
      baseUrl: siteUrl
    }
  });

  const web = new Web(siteUrl);
  const list = web.getList(`/${siteUrl.split('/').slice(3).join('/')}/Lists/Votes`.replace(/\/\//g, '/'));

  try {

    const items = await list.items.select('Id').filter(`SPDayVoteIdentity eq '${SPDayVoteIdentity}'`).get();
    if (items.length === 0) {
      await list.items.add({ SPDayVote, SPDayVoteIdentity });
    } else {
      await list.items.getById(items[0].Id).update({ SPDayVote });
    }

    context.res = {
      status: 200,
      body: 'Done'
    };

  } catch (ex) {
    context.res = {
      status: 400,
      body: ex.message
    };
  }

};
