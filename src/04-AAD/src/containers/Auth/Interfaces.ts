export interface IProps {
  azureClientId: string;
  postLogoutRedirectUri: string;
  authResource: string;
  render?: (props: IRenderProps) => React.ReactNode;
  onAuthSuccess?: (token: string) => void;
  onAuthFailure?: (error: any) => void;
  popUpDisabledCallback?: (error: string) => void;
}

export interface IRenderProps {
  token: string;
}

export interface IState {
  authenticated: boolean;
  authError?: string | null;
  userLogin?: string;
  userProfile?: IUserProfile;
  debug?: boolean;
}

export interface IUserProfile {
  firstName: string;
  lastName: string;
  fullName: string;
}
