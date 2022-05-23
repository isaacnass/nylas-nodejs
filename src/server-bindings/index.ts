import crypto from 'crypto';
import { Scope } from '../models/connect';
import mountExpress from './express';

export const buildNylasRequestVerifier = (secret: string) => (
  xNylasSignature: string,
  rawBody: any
) => {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return digest === xNylasSignature;
};

export const DEFAULT_ROUTE_PREFIX = '/nylas';

export interface IServerBindingOptions {
  routePrefix?: string;
  clientUri?: string;
  defaultScopes: Scope[];
  // tokenizationMiddleware?: Handler;
  // hostUri: string;
  // useTunnel?: boolean;
}

export const serverBindings = {
  express: mountExpress,
};
