export const aadClientId = process.env.REACT_APP_AAD_CLIENT_ID as string;
export const spoSiteUrl = process.env.REACT_APP_SPO_SITE_URL as string;
export const aadAuthResource = spoSiteUrl.split('/').slice(0, 3).join('/');
