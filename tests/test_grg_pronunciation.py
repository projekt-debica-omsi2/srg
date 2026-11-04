import importlib.util, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('grg_generator',ROOT/'generator-grg/GENERUJ_Z_GRG.py')
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
class Pronunciation(unittest.TestCase):
    def test_approved_mks(self):
        self.assertEqual(g.spoken('DĘBICA RZESZOWSKA MKS'),'Dębica, Rzeszowska MKS.')
    def test_platform_numbers_and_real_route_numbers(self):
        for raw,expected in [('BRZEZINY 04','Brzeziny.'),('WIELOPOLE SKRZYŃSKIE 1 02','Wielopole skrzyńskie jeden.'),('WIELOPOLE SKRZYŃSKIE 1 19','Wielopole skrzyńskie jeden.'),('3-MAJA CHECHŁY 1','Trzeciego maja chechły jeden.'),('ŁĄCZKI KUCHARSKIE ŁOPUCHOWA 2','Łączki kucharskie łopuchowa dwa.'),('ŚWILCZA OSIEDLE 60 N.Ż.','Świlcza osiedle.')]:
            with self.subTest(raw=raw):self.assertEqual(g.spoken(raw),expected)
    def test_complete_consistent_plan(self):
        p=g.make_plan(ROOT/'generator-grg/grgmonis.skl')
        self.assertEqual((p['voice'],p['rate']),('pl-PL-MarekNeural','-4%'))
        self.assertEqual((len(p['jobs']),len(p['directionJobs'])),(110,11))
        names={}
        for j in p['jobs']:
            self.assertEqual(names.setdefault(j['name'],j['text']),j['text'])
            self.assertNotIn('em ka es',j['text'])
            self.assertNotRegex(j['text'],r'\d')
        for j in p['directionJobs']:self.assertTrue(j['text'].startswith('Kierunek: '))
if __name__=='__main__':unittest.main()
