import { sp, Web, List } from '@pnp/sp';
import { PnpNode } from 'sp-pnp-node';

import { configPath } from '../utils/config';
import { IChartData } from './interfaces';

export class ChartAPI {

  private list: List;
  private pnpNodeFetch: PnpNode;

  constructor() {
    this.pnpNodeFetch = new PnpNode({ config: { configPath } });
    sp.setup({
      sp: {
        headers: {
          Accept: 'application/json;odata=nometadata'
        },
        fetchClientFactory: () => this.pnpNodeFetch
      }
    });
  }

  public getChartData = async (): Promise<IChartData> => {
    const loadedAt = new Date();
    await this.checkContext();
    return this.list.renderListDataAsStream({
      ViewXml: `
        <View>
          <Query>
            <GroupBy Collapse="TRUE">
              <FieldRef Name="SPDayVote" />
            </GroupBy>
          </Query>
        </View>
      `
    }).then(({ Row: data }) => {
      const votes = data.reduce((r, g) => {
        const vote = parseInt(g.SPDayVote, 10);
        const count = parseInt(g['SPDayVote.COUNT.group'], 10);
        if (vote > 0) {
          r.up += vote * count;
        }
        if (vote < 0) {
          r.down += -vote * count;
        }
        return r;
      }, { up: 0, down: 0 });
      return {
        ...votes,
        loadedAt
      };
    });
  }

  private async checkContext(): Promise<void> {
    if (typeof this.list === 'undefined') {
      const { siteUrl } = await this.pnpNodeFetch.init();
      const web = new Web(siteUrl);
      this.list = web.getList(`/${siteUrl.split('/').slice(3).join('/')}/Lists/Votes`.replace(/\/\//g, '/'));
    }
  }

}
