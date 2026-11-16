import importlib.util,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class SeedTests(unittest.TestCase):
 def load(self):
  path=ROOT/'scripts/seed_pages.py';self.assertTrue(path.exists(),'Missing verified Pages seed importer')
  spec=importlib.util.spec_from_file_location('seed_pages',path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
 def test_manifest_rejects_paths_and_unbounded_size(self):
  m=self.load()
  for path in ['../a.js','/a.js','a\\b.js','a/%2e%2e/b.js','https://other.test/a.js','a?query']:
   with self.subTest(path=path),self.assertRaises(ValueError):m.records({'files':[{'path':path,'bytes':1,'sha256':'0'*64}]})
  with self.assertRaises(ValueError):m.records({'files':[{'path':'a.js','bytes':40*1024*1024,'sha256':'0'*64}]})
 def test_bytes_are_verified_in_addition_to_url(self):
  m=self.load()
  self.assertFalse(m.matches(b'x',{'bytes':1,'sha256':'0'*64}))
  import hashlib
  self.assertTrue(m.matches(b'x',{'bytes':1,'sha256':hashlib.sha256(b'x').hexdigest()}))
 def test_duplicate_records_are_rejected(self):
  m=self.load();r={'path':'a.js','bytes':1,'sha256':'0'*64}
  with self.assertRaises(ValueError):m.records({'files':[r,r]})
