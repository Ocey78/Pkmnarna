/** Pure URL mapping. Never changes Origin headers, credentials, room tokens or packet contents. */
const assetSets=new WeakMap();
export function routeURL(value,pageURL,config,kind='http') {
  const page=new URL(pageURL), upstream=new URL(config.upstream);
  let u;
  try {u=new URL(String(value),page);}catch{return value;}
  if(!['https:','http:','ws:','wss:'].includes(u.protocol))return u.href;
  const socket=kind==='ws';
  const isLocal=socket?u.hostname===page.hostname:u.origin===page.origin;
  const isUpstream=u.hostname===upstream.hostname && (!u.port || u.port===upstream.port);
  if(!isLocal&&!isUpstream)return u.href;
  let path=u.pathname;
  if(isLocal&&config.base!=='/'&&path.startsWith(config.base)) path='/'+path.slice(config.base.length);
  if(socket) {
    if(isLocal){u.hostname=upstream.hostname;u.port=upstream.port;u.pathname=path;}
    u.protocol=upstream.protocol==='https:'?'wss:':'ws:';
    return u.href;
  }
  let assets=assetSets.get(config);
  if(!assets){assets=new Set(config.assets);assetSets.set(config,assets);}
  if(assets.has(path)) {
    return page.origin+config.base+path.replace(/^\//,'')+u.search+u.hash;
  }
  // Unknown/dynamic game resources and API endpoints use the real upstream server.
  // A server may reject this site's origin; the browser's policy is not bypassed.
  if(isLocal){u.protocol=upstream.protocol;u.host=upstream.host;u.pathname=path;}
  return u.href;
}
