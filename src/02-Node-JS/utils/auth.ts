import { sp } from '@pnp/sp';
import { AuthConfig } from 'node-sp-auth-config';
import NodeFetchClient from 'pnp-auth/lib/NodeFetchClient';

export const auth = async (configPath?: string): Promise<string> => {

  const { siteUrl, authOptions } = await new AuthConfig({ configPath }).getContext();
  const pnpNodeFetch = new NodeFetchClient(authOptions, siteUrl);

  // Binding authentication context and base URL
  sp.setup({
    sp: {
      fetchClientFactory: () => pnpNodeFetch,
      baseUrl: siteUrl
    }
  });

  return siteUrl;

};
