export interface IAppProps {
  aadClientId: string;
  spoSiteUrl: string;
  aadAuthResource: string;
}

export interface IAppState {
  loading: boolean;
  error: string;
  debug?: boolean;
  popUpDisabledUrl?: string;
}