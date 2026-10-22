/**
 * Source of the ONE CloudFront Function (viewer-request) attached to every behaviour of the distribution.
 * Generated from config so hostnames are never typed twice; tested by running the code in node:vm.
 *
 *   admin.<domain>/x  → 301 https://<domain>/admin/x      (legacy hostnames keep working)
 *   api.<domain>/x    → 301 https://<domain>/api/x
 *   www.<domain>/x    → 301 https://<domain>/x
 *   /api/<svc>/…      → /<svc>/…                           (the edge knows no /api prefix; same paths as local)
 *   /admin, /about    → 301 /admin/, /about/               (static export with trailingSlash: true)
 *   /admin/, /about/  → /admin/index.html, /about/index.html  (S3 has no directory index)
 */
export interface ViewerRequestOptions {
  /** Canonical hostname (`malinina.ca`). */
  main: string;
  /** Hostname → path prefix it redirects to on the main hostname (`''` for a plain redirect). */
  redirects: Record<string, string>;
  /** Path prefix stripped before the request reaches the API origin. */
  apiPrefix: string;
}

export function viewerRequestCode({ main, redirects, apiPrefix }: ViewerRequestOptions): string {
  return `
var MAIN = ${JSON.stringify(main)};
var REDIRECTS = ${JSON.stringify(redirects)};
var API = ${JSON.stringify(apiPrefix)};

function redirect(location) {
  return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: location } } };
}

function query(request) {
  var keys = Object.keys(request.querystring);
  if (keys.length === 0) return '';
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var entry = request.querystring[keys[i]];
    var values = entry.multiValue ? entry.multiValue : [entry];
    for (var j = 0; j < values.length; j++) parts.push(keys[i] + '=' + values[j].value);
  }
  return '?' + parts.join('&');
}

function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : MAIN;
  var uri = request.uri;

  if (host !== MAIN && Object.prototype.hasOwnProperty.call(REDIRECTS, host)) {
    return redirect('https://' + MAIN + REDIRECTS[host] + uri + query(request));
  }

  if (uri === API || uri.indexOf(API + '/') === 0) {
    request.uri = uri.slice(API.length) || '/';
    return request;
  }

  var last = uri.split('/').pop();
  if (uri.slice(-1) === '/') {
    request.uri = uri + 'index.html';
  } else if (last.indexOf('.') === -1) {
    return redirect(uri + '/' + query(request));
  }
  return request;
}
`.trimStart();
}
