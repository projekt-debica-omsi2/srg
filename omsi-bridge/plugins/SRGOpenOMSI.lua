-- Read-only rich telemetry, local PC only. No game controls.
local session = tostring({})
local ticks = 0
local last_command = nil
local result = nil
local preview = nil
local function publish_list(kind,key,list)
  local total=math.max(1,math.ceil(#list/10))
  for part=1,total do
    local chunk={}
    for i=(part-1)*10+1,math.min(part*10,#list) do chunk[#chunk+1]=list[i] end
    omsi.send(47851,omsi.json.encode({schema=2,kind=kind,session=session,route=key,part=part,total=total,stops=chunk}))
  end
end
local function commands()
  local text=omsi.files.read("command.json")
  if not text then return end
  local valid,c=pcall(omsi.json.decode,text)
  if not valid or type(c)~="table" or c.session~=session or c.id==last_command then return end
  last_command=c.id
  local ok,detail=false,"Nieznane polecenie"
  if c.action=="preview" then
    local tour=omsi.timetable.tour(c.line,c.tour)
    if tour then preview={key=c.line.."|"..c.tour,trips=tour.trips};ok=true;detail="Kursy pobrane" else detail="Brak brygady" end
  elseif c.action=="select_duty" then
    ok,detail=omsi.duty.start(c.line,c.tour,c.trip)
    if ok then omsi.duty.type_ibis();detail="Kurs ustawiony w grze; zlecono IBIS/tablice" end
  elseif c.action=="sync_signs" then
    ok=omsi.duty.type_ibis();detail=ok and "Zlecono ustawienie IBIS i tablic według kursu" or "Brak kursu lub pojazdu"
  elseif c.action=="skip_to" then
    ok=omsi.duty.skip_to(c.stop);detail=ok and "Przystanek ustawiony w grze" or "Nie udało się zmienić przystanku"
  end
  result={id=c.id,ok=ok==true,message=detail or "Odrzucono polecenie"}
end
local function compact(s)
  if not s then return nil end
  return {number=s.number,name=s.name,id=s.id,arrival=s.arrival,departure=s.departure,passed=s.passed,closed=s.closed,x=s.x,y=s.y,z=s.z}
end
omsi.every(0.5, function()
  commands()
  local info = omsi.info()
  local duty = omsi.duty.get()
  local route = duty and table.concat({tostring(duty.line),tostring(duty.tour),tostring(duty.trip),tostring(duty.trip_name)}, "|") or ""
  local x,y,z,heading = omsi.position()
  local v = {Velocity=omsi.speed(),IBIS_Linie=omsi.var("IBIS_Linie"),IBIS_Route=omsi.var("IBIS_Route"),IBIS_Ziel=omsi.var("IBIS_Ziel")}
  local d = duty and {line=duty.line,tour=duty.tour,trip=duty.trip,trip_name=duty.trip_name,terminus=duty.terminus,delay=duty.delay,at_stop=duty.at_stop,trip_done=duty.trip_done,next_stop=compact(duty.next_stop),previous_stop=compact(duty.previous_stop)} or nil
  omsi.send(47851,omsi.json.encode({schema=2,kind="status",session=session,route=route,variables=v,game="openomsi",map=info.map,clock=info.clock,paused=info.paused,duty=d,position={x=x,y=y,z=z,heading=heading},distance=info.next_stop_distance,commands=true,command_result=result,files_dir=omsi.files.dir(),vehicle_number=omsi.bus.number()}))
  ticks=ticks+1
  if ticks%4==1 then
    local catalog={}
    for _,line in ipairs(omsi.timetable.lines()) do
      if line.user_allowed then for _,tour in ipairs(line.tours or {}) do
        catalog[#catalog+1]={line=line.name,tour=tostring(tour.number),today=tour.today,trips=tour.trips}
      end end
    end
    publish_list("catalog","catalog",catalog)
    local trips={}
    local list=preview and preview.trips or omsi.duty.trips()
    for i,trip in ipairs(list) do trips[#trips+1]={number=trip.number or i,name=trip.name,terminus=trip.terminus,departure=trip.departure,arrival=trip.arrival} end
    publish_list("trips",preview and preview.key or (duty and tostring(duty.line).."|"..tostring(duty.tour) or ""),trips)
    local stops=omsi.duty.stops()
    local total=math.ceil(#stops/10)
    for part=1,total do
      local chunk={}
      for i=(part-1)*10+1,math.min(part*10,#stops) do chunk[#chunk+1]=compact(stops[i]) end
      omsi.send(47851,omsi.json.encode({schema=2,kind="stops",session=session,route=route,part=part,total=total,stops=chunk}))
    end
  end
end)
