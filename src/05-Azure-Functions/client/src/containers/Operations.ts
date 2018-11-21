import { IVote, IVoteApiProps } from './IApp';

export default class VoteAPI {

  private endpoint: string;
  private guid: string;

  constructor(props: IVoteApiProps) {
    this.guid = props.guid;
    this.endpoint = `${props.apiUri}/api/VoteFunction?code=${props.apiKey}`;
  }

  public vote(vote: IVote): Promise<any> {
    return fetch(this.endpoint, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ vote, guid: this.guid }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

}