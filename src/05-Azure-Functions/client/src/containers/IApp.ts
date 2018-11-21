export type IVote = 'up' | 'down' | undefined;

export interface IAppProps {
  apiUri: string;
  apiKey: string;
}

export interface IAppState {
  loading: boolean;
  vote: IVote;
  error?: string;
}

export interface IVoteApiProps {
  apiUri: string;
  apiKey: string;
  guid: string;
}