#!/usr/bin/env python3
"""Build the complete native catalogs, optionally reusing a previous matching Pages artifact."""
import argparse
import json
import os
import re
import build
from asset_cache import SeededFetcher, write_inventory

build.EXT=re.compile(build.EXT.pattern.replace("|txt)", "|txt|md)"), build.EXT.flags)
build.MAX_FILES=15000
build.MAX_TOTAL=750*1024*1024

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',default=os.environ.get('PAGES_BASE_PATH','/'))
    parser.add_argument('--seed',default=os.environ.get('ASSET_SEED_DIR'))
    args=parser.parse_args()
    output=build.ROOT/'dist'
    fetcher=SeededFetcher(build.fetch_public,args.seed)
    try:
        report=build.build_site(output,args.base,fetcher=fetcher)
        report['reusedUnmodifiedAssets']=fetcher.reused
        report['catalogExpansion']='roster-movement-music-menu-thunder-v2'
        manifest=write_inventory(output,report)
        report['assetCategories']=manifest['categories']
        report['assetManifest']='asset-manifest.json'
        (output/'build-report.json').write_text(json.dumps(report,indent=2))
        # Refresh manifest after recording the final report digest.
        write_inventory(output,report)
        print('ASSET_SUMMARY',json.dumps({'files':manifest['fileCount'],'bytes':manifest['totalBytes'],
            'categories':manifest['categories'],'reused':fetcher.reused,
            'unavailableReferences':len(report['missingOptionalResources'])}),flush=True)
    except Exception as error:
        print('BUILD STOPPED:',error,flush=True)
        raise SystemExit(1)

if __name__=='__main__':main()
