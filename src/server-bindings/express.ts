import express, { Express, Handler } from 'express';
import cors from 'cors';
import {
  buildNylasRequestVerifier,
  DEFAULT_ROUTE_PREFIX,
  IServerBindingOptions,
} from '.';
import Nylas from '../nylas';
import bodyParser from 'body-parser';
import { WebhookNotificationProperties } from '../models/webhook-notification';

const buildRoute = (
  options: IServerBindingOptions | undefined,
  route: string
) => ((options && options.routePrefix) || DEFAULT_ROUTE_PREFIX) + route;

const buildMiddleware = (nylasClient: Nylas): Handler => {
  const verifySignature = buildNylasRequestVerifier(nylasClient.clientSecret);

  return (req, res, next) => {
    let rawBody = '';
    req.on('data', chunk => (rawBody += chunk));
    req.on('error', err => res.status(500).send('Error parsing body'));

    req.on('end', () => {
      // because the stream has been consumed, other parsers like bodyParser.json
      // cannot stream the request data and will time out so we must explicitly parse the body
      try {
        req.body = rawBody.length ? JSON.parse(rawBody) : {};

        const isVerified = verifySignature(
          req.get('x-nylas-signature') as string,
          rawBody
        );
        if (!isVerified) {
          console.log('Failed to verify nylas signature');
          return res
            .status(401)
            .send('X-Nylas-Signature failed verification 🚷 ');
        }

        next();
      } catch (err) {
        res.status(500).send('Error parsing body');
      }
    });
  };
};

const mountExpress = async (
  nylasClient: Nylas,
  app: Express,
  options: IServerBindingOptions
) => {
  const webhookRoute = buildRoute(options, '/webhook');

  // const hostUri = options.hostUri.startsWith('localhost://') ? await bindTunnel(options.hostUri) : options.hostUri
  // nylasClient.webhooks.build
  // await nylasClient.webhooks!.build({
  //   callbackUrl: hostUri + webhookRoute,
  //   state: "active",
  //   test: true,
  //   triggers: Object.values(NylasTrackingEvents),
  // }).save();

  app.use(
    buildRoute(options, ''),
    cors(
      options.clientUri
        ? {
            optionsSuccessStatus: 200,
            origin: options.clientUri,
          }
        : undefined
    ) as any,
    express.json(),
    bodyParser.urlencoded({ limit: '5mb', extended: true }) // support encoded bodies
  );

  app.get(webhookRoute, function(req, res) {
    if (req.query.challenge) {
      res.setHeader('content-type', 'text/plain');
      console.log(req.query);
      res.status(200).send(req.query.challenge);
      return;
    }
  });
  app.get(webhookRoute, (req, res) => {
    return res.status(200).send(req.query.challenge);
  });

  app.post<unknown, unknown, WebhookNotificationProperties>(
    webhookRoute,
    // Middleware ain't working yet, disabling :(
    // buildMiddleware(nylasClient) as any,
    (req, res) => {
      const deltas = req.body.deltas || [];
      deltas.forEach(d => {
        d.type && nylasClient.emit(d.type, d);
      });
      res.status(200).send('ok')
    }
  );

  app.post(buildRoute(options, '/generate-auth-url'), (req, res) => {
    // Todo: CSRF token generation procedure
    const auth_url = nylasClient.urlForAuthentication({
      loginHint: req.body.email_address,
      redirectURI: (options.clientUri || '') + req.body.success_url,
      scopes: options.defaultScopes,
    });
    res.status(200).send(auth_url);
  });

  app.post(buildRoute(options, '/exchange-mailbox-token'), async (req, res) => {
    try {
      const accessTokenObj = await nylasClient.exchangeCodeForToken(
        req.body.token
      );
      nylasClient.emit('token-exchange', {
        accessTokenObj,
        res,
      });

      // If the callback event already sent a response then we don't need to do anything
      if (!res.writableEnded) {
        res.status(200).send('success');
      }
    } catch (e) {
      res.status(500).send((e as any).message);
    }
  });
};

export default mountExpress;
