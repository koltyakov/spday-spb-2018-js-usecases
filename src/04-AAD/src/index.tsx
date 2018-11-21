import './index.scss';
import './utils/polyfills';

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './containers/App';
import { IAppProps } from './containers/IApp';
import { aadClientId, spoSiteUrl, aadAuthResource } from './utils/env';

const appProps: IAppProps = { aadClientId, spoSiteUrl, aadAuthResource };

ReactDOM.render(<App {...appProps} />, document.getElementById('root'));
