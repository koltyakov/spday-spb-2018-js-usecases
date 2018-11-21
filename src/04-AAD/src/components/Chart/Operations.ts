import { Web, List } from '@pnp/sp';

import { IChartApiProps, IChartData } from './interfaces';

export class ChartAPI {

  private list: List;

  constructor(props: IChartApiProps) {
    const web = new Web(props.webAbsUrl);
    this.list = web.getList(`/${props.webAbsUrl.split('/').slice(3).join('/')}/Lists/Votes`.replace(/\/\//g, '/'));
  }

  public getChartData(): Promise<IChartData> {
    const loadedAt = new Date();
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
      const votes = data.reduce((r: any, g: any) => {
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

}
