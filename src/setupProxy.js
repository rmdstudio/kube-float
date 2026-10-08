// Copyright (c) 2026 rmd Studio Inc. MIT License.
//
// Forwards /k8s/* from the dev server to `kubectl proxy`, which holds the
// credentials. Only the handful of read requests the app makes are let through.
const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.KUBE_FLOAT_PROXY || 'http://127.0.0.1:8717';

const NAME = '[a-z0-9]([a-z0-9.-]*[a-z0-9])?';
const ALLOWED = [
  /^\/api\/v1\/(pods|services|persistentvolumeclaims)$/,
  /^\/apis\/apps\/v1\/(deployments|statefulsets|daemonsets|replicasets)$/,
  /^\/apis\/batch\/v1\/(jobs|cronjobs)$/,
  /^\/apis\/networking\.k8s\.io\/v1\/ingresses$/,
  new RegExp(`^/api/v1/namespaces/${NAME}/pods/${NAME}/log$`),
];

module.exports = function setupProxy(app) {
  app.use('/k8s', (req, res, next) => {
    if (req.method !== 'GET') {
      res.status(405).json({ message: 'kube-float is read-only' });
    } else if (!ALLOWED.some((pattern) => pattern.test(req.path))) {
      res.status(403).json({ message: 'kube-float does not read that resource' });
    } else {
      next();
    }
  });

  app.use(
    createProxyMiddleware('/k8s', {
      target,
      changeOrigin: true,
      pathRewrite: { '^/k8s': '' },
      logLevel: 'warn',
      onProxyRes(proxyRes) {
        // Stops the dev server's gzip from buffering log streams.
        proxyRes.headers['cache-control'] = 'no-cache, no-transform';
      },
      onError(err, req, res) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'kubectl proxy is not reachable' }));
      },
    })
  );
};
