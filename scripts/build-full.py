#!/usr/bin/env python3
"""Run the verified importer with bounds covering all native movement/form assets."""
import build

# The native movement table alone contains more than 6,000 small sprite sheets.
# Source hashes, URL restrictions, per-file size limits and atomic deployment remain unchanged.
build.MAX_FILES = 12000
build.MAX_TOTAL = 750 * 1024 * 1024

if __name__ == '__main__':
    build.main()
