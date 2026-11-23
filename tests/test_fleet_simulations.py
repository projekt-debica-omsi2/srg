import unittest,sys,json
from pathlib import Path
from datetime import datetime,date
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'fleet-server'))
from simulations import merge_scheduled,materialize,runs_on,WARSAW
class Simulations(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.trips=json.loads((Path(__file__).resolve().parents[1]/'fleet-server/schedules.json').read_text(encoding='utf-8'))['trips']
 def test_schedule_only_during_trip(self):
  t=next(t for t in self.trips if t['duty']=='S-24!' and t['tripNo']==1);now=datetime(2026,11,23,8,30,tzinfo=WARSAW)
  p=materialize(t,now.date(),now);self.assertIsNotNone(p);self.assertTrue(p['route']);self.assertIsNone(p['delay']);self.assertIsNone(materialize(t,now.date(),now.replace(hour=9,minute=5)))
 def test_online_claim_and_alias_hide_simulation(self):
  t=next(t for t in self.trips if len(t['aliases'])>1);now=datetime(2026,11,23,8,30,tzinfo=WARSAW)
  alias=t['aliases'][-1];real={'number':'998','online':True,'payload':{'duty':alias['duty'],'tripNo':alias['tripNo']}}
  result=merge_scheduled([real],[t],now);self.assertEqual(result,[real])
 def test_offline_estimate_has_no_fake_identity_or_delay(self):
  t=next(t for t in self.trips if t['duty']=='S-24!' and t['tripNo']==1);now=datetime(2026,11,23,8,30,tzinfo=WARSAW)
  real={'number':'998','online':False,'display':'private','payload':{'duty':t['duty'],'tripNo':1,'delay':'-10:00'}}
  result=merge_scheduled([real],[t],now);self.assertEqual(len(result),1);v=result[0];self.assertTrue(v['simulation']);self.assertFalse(v['online']);self.assertEqual(v['display'],'');self.assertIsNone(v['payload']['delay']);self.assertNotEqual(v['number'],'998')
 def test_calendar(self):
  self.assertTrue(runs_on({'serviceCode':'DN'},date(2026,11,23)));self.assertFalse(runs_on({'serviceCode':'DN'},date(2026,11,22)));self.assertFalse(runs_on({'serviceCode':'DN'},date(2026,12,25)))
  self.assertFalse(runs_on({'serviceCode':'SX'},date(2027,1,20)));self.assertTrue(runs_on({'serviceCode':'SX'},date(2027,2,2)));self.assertFalse(runs_on({'serviceCode':'Dnj'},date(2026,12,31)))
 def test_online_grudna_replaces_both_alternative_routings(self):
  trips=[t for t in self.trips if t['duty'] in ('S-24','S-24!') and t['tripNo']==4]
  self.assertEqual(len(trips),2)
  now=datetime(2026,11,23,16,0,tzinfo=WARSAW)
  for duty in ('S-24','S-24!'):
   real={'number':'998','online':True,'payload':{'duty':duty,'tripNo':4,'departure':'15:40','arrival':'16:43'}}
   self.assertEqual(merge_scheduled([real],trips,now),[real])
 def test_same_destination_different_run_still_simulated(self):
  trips=[t for t in self.trips if t['duty']=='S-24' and t['tripNo']==4]
  real={'number':'998','online':True,'payload':{'duty':'S-24!','tripNo':4,'departure':'15:45','arrival':'16:43'}}
  result=merge_scheduled([real],trips,datetime(2026,11,23,16,0,tzinfo=WARSAW))
  self.assertEqual(len(result),2);self.assertTrue(result[-1]['simulation'])
 def test_interpolation_follows_stop_chain(self):
  t={'id':'test','duty':'T','tripNo':1,'aliases':[],'departure':'08:00','arrival':'08:20','serviceCode':'DN','direction':'C','route':[{'name':'A','lat':50,'lon':21,'time':'08:00'},{'name':'B','lat':50,'lon':21.01,'time':None},{'name':'C','lat':50.01,'lon':21.01,'time':'08:20'}]}
  p=materialize(t,date(2026,11,23),datetime(2026,11,23,8,5,tzinfo=WARSAW));self.assertTrue(p['lat']==50 or p['lon']==21.01);self.assertIsNone(p['route'][1]['plannedAt'])
 def test_no_cancelled_duties(self):self.assertTrue(all(not t['duty'].startswith(('MIS','Bak','Bąk')) for t in self.trips))
 def test_legacy_claim_matches_trip_time(self):
  t=next(t for t in self.trips if t['duty']=='S-24!' and t['tripNo']==1);now=datetime(2026,11,23,8,30,tzinfo=WARSAW);p=materialize(t,now.date(),now);real={'number':'998','online':True,'payload':p.copy()};del real['payload']['duty'];del real['payload']['tripNo'];self.assertEqual(merge_scheduled([real],[t],now),[real])
if __name__=='__main__':unittest.main()
