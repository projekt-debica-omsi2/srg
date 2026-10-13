from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent/'app/src/main/assets/index.html'
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-web-security'])
 page=browser.new_page(viewport={'width':1024,'height':600}, device_scale_factor=1)
 errs=[]
 page.on('pageerror',lambda ex:errs.append(str(ex)))
 html=p.read_text(encoding='utf8')
 for name in ['auto-gps.js','voice-gps.js','schedule-deviation.js']:
  dep=(p.parent/name).read_text(encoding='utf8')
  html=html.replace('<script src="'+name+'"></script>','<script>'+dep+'</script>')
 page.set_content(html,wait_until='load',timeout=20000)
 if not page.evaluate('!!window.__srg'):
  print('UI not ready, errors',errs[:5]);raise SystemExit(1)
 def load(task,trip):
  page.evaluate('''([task,trip])=>{const s=window.__srg.state; s.driverLoggedIn=true;
    const duty=window.__srg.dutyEntries(task),c=duty.find(c=>c.tripNo===trip);
    if(!c)throw Error('not found '+task+':'+trip);
    window.__srg.selectCourse(c); s.routeIndex=s.variant.stops.length-1;s.pendingStop=null;
    s.courseStartedNotified=true;window.__srg.closeCourseStarted();window.__srg.refreshCourse();
  }''',[task,trip])
 load('S-25',4)
 page.click('#nextStop')
 assert page.locator('#endDutyOverlay.open').count()==1,'final S25 no overlay'
 assert page.locator('#tripFinishOverlay.open').count()==0,'unexpected yes/no confirmation'
 assert page.locator('#endDutyOverlay .endDutyMain').inner_text()=='Zakończono wykonywanie kursówki'
 assert page.locator('#endDutyOverlay .endDutyTap').inner_text()=='(kliknij aby zamknąć)'
 assert page.evaluate('window.__srg.state.course===null'),'course still active'
 assert page.evaluate('window.__srg.state.driverLoggedIn'),'driver logged out'
 shot=Path(__file__).resolve().parent/'PODGLAD_ZAKONCZENIA_KURSOWKI.png'
 page.screenshot(path=str(shot)); print('saved',shot)
 page.click('#endDutyOverlay')
 assert page.locator('#endDutyOverlay.open').count()==0
 assert page.locator('#idle.active').count()==1,'did not return to idle'
 load('S-27',6)
 page.click('#nextStop')
 assert page.locator('#endDutyOverlay.open').count()==1,'final S27 no overlay'
 page.keyboard.press('Escape')
 assert page.locator('#endDutyOverlay.open').count()==0,'escape did not close'
 load('S-25',3)
 page.click('#nextStop')
 assert page.locator('#tripFinishOverlay.open').count()==1,'earlier trip should get confirmation'
 assert page.locator('#endDutyOverlay.open').count()==0,'duty should not end before final trip'
 page.click('#tripFinishYes')
 assert page.evaluate('window.__srg.state.course.tripNo')==4,'wrong next trip'
 assert page.locator('#endDutyOverlay.open').count()==0
 load('S-25',4)
 page.evaluate('window.__srg.state.routeIndex=0;window.__srg.refreshCourse()')
 page.click('#nextStop')
 assert page.locator('#endDutyOverlay.open').count()==0,'ended prematurely on early stop'
 assert page.evaluate('window.__srg.state.pendingStop')==1
 print('PASS browser cases: S-25 final, S-27 final, ESC, previous course, normal stop')
 print('page errors:',errs[:4])
 browser.close()
