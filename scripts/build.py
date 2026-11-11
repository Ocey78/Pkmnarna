#!/usr/bin/env python3
"""Import public game assets at build time; never distribute upstream bytes in this repo.
Requires Python 3.11+ and Node 22+. No pip/npm dependencies. Unknown builds fail closed.
"""
from __future__ import annotations
import argparse
import base64
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote, parse_qsl
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://poke2darena.com'
GAME=ORIGIN+'/play-online/'
MAX_FILE=32*1024*1024
MAX_TOTAL=350*1024*1024
MAX_FILES=5000
EXT=re.compile(r'\.(?:m?js|css|json|png|jpe?g|webp|svg|gif|ico|ogg|mp3|wav|m4a|woff2?|ttf|bin|wasm|atlas|xml|txt)$',re.I)
CSS_URL=re.compile(r'url\(\s*([\"\']?)([^)]+?)\1\s*\)',re.I)
CSS_IMPORT=re.compile(r'(@import\s+)([\"\'])([^\"\']+)\2',re.I)


def base_path(value):
    value=str(value).strip()
    if '//' in value or re.search(r'[?#%\\\s]',value):raise ValueError('Invalid Pages base path')
    parts=[p for p in value.split('/') if p]
    if any(p in ('.','..') or not re.fullmatch(r'[a-zA-Z0-9_.-]+',p) for p in parts):
        raise ValueError('Invalid Pages base path')
    return '/'+('/'.join(parts)+'/' if parts else '')


def disk_path(url):
    p=unquote(urlsplit(url).path)
    if '\\' in p or '\x00' in p or any(x in ('.','..') for x in p.split('/')):
        raise ValueError('Unsafe asset path')
    return Path(*PurePosixPath(p.lstrip('/')).parts)


def resource_url(value,base):
    if not isinstance(value,str) or not value or len(value)>2048:return None
    try:
        u=urlsplit(urljoin(base,value.strip()))
        if u.scheme!='https' or u.netloc!='poke2darena.com' or u.username or u.password:return None
        if re.match(r'^/(?:api|auth|login|logout|account)(?:/|$)',u.path):return None
        if any(k not in {'v','ver','version','t','hash'} for k,v in parse_qsl(u.query)):return None
        if not EXT.search(u.path):return None
        result=urlunsplit((u.scheme,u.netloc,u.path,u.query,''));disk_path(result)
        return result
    except (ValueError,TypeError):return None


class StrictRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        u=urlsplit(newurl)
        if u.scheme!='https' or u.netloc!='poke2darena.com':
            raise RuntimeError('Refusing cross-origin asset redirect')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch_public(url):
    if url!=GAME and resource_url(url,GAME)!=url:raise ValueError('Not an approved public resource URL')
    opener=build_opener(StrictRedirect())
    request=Request(url,headers={'User-Agent':'Poke2D-Pages-Importer/0.1','Accept-Encoding':'identity'})
    for attempt in range(2):
        try:
            with opener.open(request,timeout=35) as response:
                if int(response.headers.get('Content-Length','0'))>MAX_FILE:raise RuntimeError('Resource exceeds 32 MiB')
                data=response.read(MAX_FILE+1)
                if len(data)>MAX_FILE:raise RuntimeError('Resource exceeds 32 MiB')
                return data
        except Exception:
            if attempt:raise
            time.sleep(1)
    raise RuntimeError('Download failed')


def jsop(op,**kwargs):
    result=subprocess.run(['node',str(ROOT/'scripts/source.mjs')],input=json.dumps({'op':op,**kwargs}),
        text=True,capture_output=True,timeout=90)
    if result.returncode:raise RuntimeError(result.stderr.strip() or 'JavaScript processing failed')
    return json.loads(result.stdout)


def patch_module(data,url):
    return jsop('patch',bytes=base64.b64encode(data).decode(),url=url)


class HTMLResources(HTMLParser):
    def __init__(self,base=GAME):
        super().__init__(convert_charrefs=True);self.base=base;self.refs=[];self.entries=[];self.inline=[];self.tag=None;self.script_type=''
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='script':
            self.tag='script';self.script_type=attrs.get('type','')
            src=attrs.get('src')
            if src:
                url=resource_url(src,self.base)
                if url:self.refs.append((url,True))
                if attrs.get('type')=='module' and url and re.search(r'/play-online/assets/index-[\w-]+\.js$',urlsplit(url).path):self.entries.append(url)
        if tag=='style':self.tag='style'
        if tag=='link' and attrs.get('rel') in ('stylesheet','preload','modulepreload','icon','manifest'):
            url=resource_url(attrs.get('href'),self.base)
            if url:self.refs.append((url,attrs.get('rel') in ('stylesheet','modulepreload')))
        if tag in ('img','source','audio','video','input'):
            for name in ('src','poster'):
                url=resource_url(attrs.get(name),self.base)
                if url:self.refs.append((url,False))
        if attrs.get('style'):
            self.refs.extend((url,False) for url in css_refs(attrs['style'],self.base))
    def handle_endtag(self,tag):
        if tag==self.tag:self.tag=None
    def handle_data(self,data):
        if self.tag=='style':self.refs.extend((url,False) for url in css_refs(data,self.base))
        if self.tag=='script' and self.script_type in ('','module','text/javascript','application/javascript') and data.strip():self.inline.append(data)


def discover_entry(html):
    parser=HTMLResources();parser.feed(html)
    if len(parser.entries)!=1:raise ValueError('Expected a single native game entry module; website layout changed')
    return parser.entries[0]


def css_refs(text,base):
    result=[]
    for value in [m.group(2).strip().strip('"\'') for m in CSS_URL.finditer(text)]+[m.group(3) for m in CSS_IMPORT.finditer(text)]:
        url=resource_url(value,base)
        if url:result.append(url)
    return result


def local_reference(value,context,assets,base):
    url=resource_url(value,context)
    if url in assets:
        u=urlsplit(url);return base+u.path.lstrip('/')+('?' + u.query if u.query else '')
    return value


def rewrite_css(text,context,assets,base):
    text=CSS_URL.sub(lambda m:'url('+m.group(1)+local_reference(m.group(2).strip().strip('"\''),context,assets,base)+m.group(1)+')',text)
    return CSS_IMPORT.sub(lambda m:m.group(1)+m.group(2)+local_reference(m.group(3),context,assets,base)+m.group(2),text)


def json_refs(value,context):
    found=[]
    if isinstance(value,dict):
        for child in value.values():found.extend(json_refs(child,context))
    elif isinstance(value,list):
        for child in value:found.extend(json_refs(child,context))
    elif isinstance(value,str):
        url=resource_url(value,context)
        if url:found.append(url)
    return found



class HTMLRewriter(HTMLParser):
    def __init__(self,context,assets,base):
        super().__init__(convert_charrefs=False);self.context=context;self.assets=assets;self.base=base;self.out=[];self.raw=None;self.script_type=''
    def handle_decl(self,decl):self.out.append('<!'+decl+'>')
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=='base':return
        # The new host owns its own document policy. Upstream HTTP headers are not copied.
        if tag=='meta' and d.get('http-equiv','').lower()=='content-security-policy':return
        changed=[]
        for k,v in attrs:
            if v is not None and k in ('src','href','poster'):
                v=local_reference(v,self.context,self.assets,self.base)
                if tag=='a' and k=='href' and v.startswith('/') and not v.startswith(self.base+'play-online/'):
                    v=urljoin(ORIGIN,v)
            if v is not None and k=='style':v=rewrite_css(v,self.context,self.assets,self.base)
            if tag in ('script','link') and k=='integrity':continue # transformed local bytes have a new digest
            changed.append(k if v is None else k+'="'+escape(v,quote=True)+'"')
        self.out.append('<'+tag+(' '+' '.join(changed) if changed else '')+'>')
        if tag=='head':
            b=escape(self.base,quote=True)
            self.out.append(f'<base href="{b}play-online/"><script src="{b}runtime-config.js"></script><script src="{b}network.js"></script>')
        if tag in ('script','style'):self.raw=tag;self.script_type=d.get('type','')
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
    def handle_endtag(self,tag):
        if tag=='base':return
        self.out.append('</'+tag+'>')
        if self.raw==tag:self.raw=None
    def handle_data(self,data):
        if self.raw=='style':data=rewrite_css(data,self.context,self.assets,self.base)
        elif self.raw=='script' and self.script_type in ('','module','text/javascript','application/javascript') and data.strip():
            data=jsop('rewrite',source=data,url=self.context,base=self.base,assets=list(self.assets))['source']
        self.out.append(data)
    def handle_comment(self,data):self.out.append('<!--'+data+'-->')
    def handle_entityref(self,name):self.out.append('&'+name+';')
    def handle_charref(self,name):self.out.append('&#'+name+';')


def rewrite_html(html,context,assets,base):
    if not re.search(r'<head\b',html,re.I):raise ValueError('The game document has no head element')
    parser=HTMLRewriter(context,assets,base);parser.feed(html);parser.close();return ''.join(parser.out)


def build_site(output,base='/',*,fetcher=fetch_public,patcher=patch_module):
    """Dependency injection is only used by unit tests; the CLI always verifies real source hashes."""
    base=base_path(base);output=Path(output).resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    stage=Path(tempfile.mkdtemp(prefix='.poke2d-build-',dir=output.parent))
    try:
        print('Reading official game page...',flush=True)
        html=fetcher(GAME).decode('utf-8-sig');entry=discover_entry(html)
        raw=fetcher(entry)
        patched=patcher(raw,entry)  # Reject before crawling/deploying anything else.
        original_scan=jsop('scan',source=raw.decode('utf-8-sig'),url=entry)
        resources={entry:patched['source'].encode()};scanned=set();pending=deque();requirements={}
        missing=[];dynamic=[];external=set(original_scan['external']);total=len(raw)
        def enqueue(url,required=False):
            url=resource_url(url,GAME)
            if not url:return
            if url in requirements:
                requirements[url]=requirements[url] or required;return
            if len(requirements)>=MAX_FILES:raise RuntimeError('Resource count limit exceeded; review the import report')
            requirements[url]=required
            if url not in resources:pending.append(url)
        parsed=HTMLResources();parsed.feed(html)
        for url,required in parsed.refs:enqueue(url,required)
        for inline in parsed.inline:
            result=jsop('scan',source=inline,url=GAME)
            for ref in result['references']:enqueue(ref['url'],ref['required'])
            dynamic.extend(result['dynamic']);external.update(result['external'])
        def scan(url,data):
            if url in scanned:return
            scanned.add(url);path=urlsplit(url).path.lower()
            if path.endswith(('.js','.mjs')):
                result=jsop('scan',source=data.decode('utf-8-sig'),url=url)
                for ref in result['references']:enqueue(ref['url'],ref['required'])
                dynamic.extend(result['dynamic']);external.update(result['external'])
            elif path.endswith('.css'):
                for ref in css_refs(data.decode('utf-8-sig'),url):enqueue(ref,ref.endswith('.css'))
            elif path.endswith('.json'):
                for ref in json_refs(json.loads(data),url):enqueue(ref,False)
        scan(entry,resources[entry])
        with ThreadPoolExecutor(max_workers=4) as pool:
            while pending:
                batch=[pending.popleft() for _ in range(min(4,len(pending)))]
                futures=[pool.submit(fetcher,url) for url in batch]
                for url,future in zip(batch,futures):
                    try:data=future.result()
                    except Exception as error:
                        if requirements[url]:raise RuntimeError(f'Required resource failed: {url}: {error}') from error
                        missing.append({'url':url,'error':str(error)[:200]});continue
                    if len(data)>MAX_FILE:raise RuntimeError('Per-file limit exceeded')
                    total+=len(data)
                    if total>MAX_TOTAL:raise RuntimeError('Total import size exceeds 350 MiB')
                    resources[url]=data;scan(url,data)
                if len(resources)%20<4:print(f'Imported {len(resources)} static resources...',flush=True)
        # A dependency initially optional may have been discovered as required later.
        for miss in missing:
            if requirements.get(miss['url']):raise RuntimeError('Required resource unavailable: '+miss['url'])
        urls=set(resources);paths={}
        for url,data in resources.items():
            relative=disk_path(url)
            if relative in paths and resources[paths[relative]]!=data:
                raise RuntimeError('Query-dependent asset cannot be represented by static Pages: '+str(relative))
            paths[relative]=url
            path=urlsplit(url).path.lower()
            if path.endswith(('.js','.mjs')):
                source=jsop('rewrite',source=data.decode('utf-8-sig'),url=url,base=base,assets=list(urls))['source']
                if url==entry:source+='\n;window.dispatchEvent(new Event("roster-client-module-evaluated"));\n'
                data=source.encode()
            elif path.endswith('.css'):data=rewrite_css(data.decode('utf-8-sig'),url,urls,base).encode()
            # Keep JSON bytes untouched: frame names and IDs are not URLs to rewrite.
            target=stage/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        (stage/'play-online').mkdir(exist_ok=True)
        (stage/'play-online/index.html').write_text(rewrite_html(html,GAME,urls,base),encoding='utf-8')
        for src in (ROOT/'site').iterdir():
            if src.is_file():shutil.copyfile(src,stage/src.name)
        (stage/'data').mkdir(exist_ok=True);shutil.copyfile(ROOT/'data/roster.json',stage/'data/roster.json')
        # Classic script, deliberately before native module execution, with no runtime dependencies.
        routing=(ROOT/'site/routing.mjs').read_text().replace('export function routeURL','function routeURL')
        network=(ROOT/'site/network.js').read_text()
        (stage/'network.js').write_text('(()=>{\n"use strict";\n'+routing+'\n'+network+'\n})();\n')
        config={'upstream':ORIGIN,'base':base,'assets':sorted({urlsplit(url).path for url in resources})}
        (stage/'runtime-config.js').write_text('globalThis.Poke2DHostConfig=Object.freeze('+json.dumps(config).replace('<','\\u003c')+');\n')
        report={'schema':1,'buildStatus':'imported','builtAt':datetime.now(timezone.utc).isoformat(),
            'upstream':ORIGIN,'sourceURL':entry,'sourceSHA256':patched['hash'],'base':base,
            'rosterEntries':len(json.loads((ROOT/'data/roster.json').read_text())),
            'staticResources':len(resources),'downloadedBytes':total,'officialMultiplayer':'unverified',
            'physicalIPhone':'unverified','externalReferences':sorted(external),
            'unresolvedDynamicReferences':sorted(set(dynamic)), 'missingOptionalResources':missing,
            'note':'Import/patch success does not prove gameplay, complete dynamic-asset coverage, or official-server acceptance.'}
        (stage/'build-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        (stage/'.nojekyll').touch()
        # Keep any last successful site intact until every step above completes.
        backup=None
        if output.exists():
            backup=Path(tempfile.mkdtemp(prefix='.poke2d-previous-',dir=output.parent));backup.rmdir();os.replace(output,backup)
        try:os.replace(stage,output)
        except Exception:
            if backup:os.replace(backup,output)
            raise
        if backup:shutil.rmtree(backup)
        print(f'Imported {len(resources)} resources. Output: {output}. Official multiplayer is UNVERIFIED.',flush=True)
        return report
    finally:
        if stage.exists():shutil.rmtree(stage)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',default=os.environ.get('PAGES_BASE_PATH','/'))
    args=parser.parse_args()
    try:build_site(ROOT/'dist',args.base)
    except Exception as error:
        print('BUILD STOPPED:',error,flush=True)
        print('No new site was deployed. See README troubleshooting; do not disable build verification.',flush=True)
        raise SystemExit(1)

if __name__=='__main__':main()
