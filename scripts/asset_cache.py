"""Reuse unmodified binary assets from this repository's previous build and inventory them.
Code, HTML and styles always come freshly from the upstream host. A seed is only
used after its native-source SHA-256 matches the freshly fetched entry bytes.
"""
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit

ENTRY='https://poke2darena.com/play-online/assets/index-BBhViti1.js'
BINARY={'.png','.gif','.jpg','.jpeg','.webp','.ico','.ogg','.mp3','.wav','.m4a','.json','.xml','.atlas','.svg','.bin','.wasm'}

class SeededFetcher:
    def __init__(self, fetcher, seed=None):
        self.fetcher=fetcher
        self.seed=Path(seed).resolve() if seed else None
        self.seed_hash=None
        self.current_hash=None
        self.reused=0
        if self.seed:
            try:
                self.seed_hash=json.loads((self.seed/'build-report.json').read_text())['sourceSHA256']
            except (OSError,ValueError,KeyError):
                self.seed=None
    def __call__(self,url):
        if url==ENTRY:
            data=self.fetcher(url)
            self.current_hash=hashlib.sha256(data).hexdigest()
            return data
        parsed=urlsplit(url)
        if (self.seed and self.current_hash and self.current_hash==self.seed_hash
            and parsed.scheme=='https' and parsed.netloc=='poke2darena.com'
            and not parsed.query and not parsed.fragment):
            relative=unquote(parsed.path).lstrip('/')
            if '\\' not in relative and not any(p in ('.','..') for p in relative.split('/')):
                p=(self.seed/relative).resolve()
                if p.is_relative_to(self.seed) and p.suffix.lower() in BINARY and p.is_file():
                    if 0<p.stat().st_size<=32*1024*1024:
                        data=p.read_bytes()
                        # Refuse cached HTML error pages masquerading as media files.
                        if not data.lstrip().lower().startswith((b'<!doctype html',b'<html')):
                            self.reused+=1
                            return data
        return self.fetcher(url)

def category(path):
    for prefix,name in [('assets/pokemon/','pokemon'),('assets/movement/','movement'),
            ('assets/cries/','cries'),('play-online/ui/','ui'),('play-online/vfx/','effects'),
            ('play-online/audio/','audio'),('play-online/stages/','arenas')]:
        if path.startswith(prefix):return name
    return 'other'

def write_inventory(root,report):
    root=Path(root)
    files=[];categories={}
    for p in sorted(root.rglob('*')):
        if not p.is_file() or p.name=='asset-manifest.json':continue
        path=p.relative_to(root).as_posix();data=p.read_bytes();kind=category(path)
        files.append({'path':path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'category':kind})
        categories[kind]=categories.get(kind,0)+1
    result={'schema':1,'sourceSHA256':report['sourceSHA256'],'files':files,'categories':categories,
        'fileCount':len(files),'totalBytes':sum(f['bytes'] for f in files),
        'unavailableReferences':report.get('missingOptionalResources',[]),
        'scope':'All successfully imported references from the supported native client and expanded catalogs; unavailable upstream references remain listed, never fabricated.'}
    (root/'asset-manifest.json').write_text(json.dumps(result,indent=2))
    return result
