import importlib.util,json,pathlib,tempfile,unittest,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
class RocketHostTests(unittest.TestCase):
 def load(self):
  path=ROOT/'scripts/rocket_host.py'
  self.assertTrue(path.exists(),'Rocket build adapter has not been implemented')
  spec=importlib.util.spec_from_file_location('rocket_host',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_root_has_no_picker_and_preserves_invitation(self):
  html=(ROOT/'site/index.html').read_text()
  self.assertNotIn('id="launcher"',html)
  self.assertIn('location.replace',html)
  self.assertIn('location.search',html)
  self.assertIn('location.hash',html)
 def test_no_custom_host_overlay(self):
  self.assertNotIn('poke2d-host-tools',(ROOT/'site/network.js').read_text())
 def test_unapproved_archive_fails_before_extract(self):
  m=self.load()
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d);bad=p/'wrong.zip'
   with zipfile.ZipFile(bad,'w') as z:z.writestr('../escape.js','bad')
   with self.assertRaisesRegex(ValueError,'fingerprint'):m.extract_extension(bad,p/'out')
   self.assertFalse((p/'escape.js').exists());self.assertFalse((p/'out').exists())
 def test_native_html_injects_only_original_menu_content_script(self):
  m=self.load()
  html='<html><head><base href="/Pkmnarna/play-online/"><script src="/Pkmnarna/network.js"></script><script type="module" src="/Pkmnarna/play-online/assets/index-BBhViti1.js"></script></head><body><div id="app"></div></body></html>'
  actual=m.native_html(html,'/Pkmnarna/','/Pkmnarna/')
  self.assertEqual(actual.count('src="/Pkmnarna/rocket-menu.js"'),1)
  self.assertIn('rocket=1.9.56',actual)
  self.assertNotIn('recovery.bundle.js',actual)
  self.assertIn('<div id="app"></div>',actual)
 def test_native_html_is_idempotent_on_a_second_deployment(self):
  m=self.load()
  html='<html><head><script src="/Pkmnarna/network.js"></script><script type="module" src="/Pkmnarna/play-online/assets/index-BBhViti1.js"></script></head><body></body></html>'
  first=m.native_html(html,'/Pkmnarna/','/Pkmnarna/')
  self.assertEqual(m.native_html(first,'/Pkmnarna/','/Pkmnarna/'),first)
 def test_native_html_rejects_unexpected_module(self):
  m=self.load()
  with self.assertRaisesRegex(ValueError,'native entry'):m.native_html('<html><head></head></html>','/Pkmnarna/','/Pkmnarna/')
if __name__=='__main__':unittest.main()
