-- Generic openOMSI adapter: runtime map/vehicle data and explicit controller commands.
local session = tostring({})
local ticks = 0
local last_command = nil
local result = nil
local preview = nil
local context_key = nil
local function has(name)
  return omsi.game.has(name)
end
local function signs()
  local duty=omsi.duty.get()
  if not duty or not omsi.has_vehicle() then return false,"Brak kursu lub pojazdu" end
  local line_ok=omsi.bus.set_line(tostring(duty.line))
  local typed=has("duty.type_ibis") and omsi.duty.type_ibis() or false
  local destination_ok=false
  for _,destination in ipairs(omsi.bus.destinations()) do
    if type(destination.name)=="string" and type(duty.terminus)=="string" and string.lower(destination.name)==string.lower(duty.terminus) then
      destination_ok=omsi.bus.set_destination(destination.index);break
    end
  end
  if destination_ok then return line_ok==true,"Ustawiono linię i kierunek z HOF autobusu" end
  if typed then return true,"Zlecono IBIS; sprawdź zgodność tablic i pliku HOF autobusu" end
  return false,"Autobus nie udostępnia zgodnego kierunku HOF/IBIS"
end
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
    local tour=omsi.timetable.tour(c.line,c.tour)
    local trip=tour and tour.trips[c.trip]
    if not trip then
      ok=false;detail="Nie ma takiego kursu"
    elseif c.align_time and not omsi.world.set_time(trip.departure%86400) then
      ok=false;detail="Gra nie pozwala zmienić czasu"
    else
      ok,detail=omsi.duty.start(c.line,c.tour,c.trip)
    end
    if ok then local _,message=signs();detail="Kurs ustawiony. "..message end
  elseif c.action=="sync_signs" then
    ok,detail=signs()
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
  local vehicle_file=omsi.bus.file()
  local active_context=tostring(info.map_path or info.map).."|"..tostring(vehicle_file)
  if active_context~=context_key then context_key=active_context;preview=nil end
  local route = duty and table.concat({active_context,tostring(duty.line),tostring(duty.tour),tostring(duty.trip),tostring(duty.trip_name)}, "|") or active_context
  local x,y,z,heading = omsi.position()
  local v = {Velocity=omsi.has_vehicle() and omsi.speed() or nil,IBIS_Linie=omsi.var("IBIS_Linie"),IBIS_Route=omsi.var("IBIS_Route"),IBIS_Ziel=omsi.var("IBIS_Ziel")}
  local d = duty and {line=duty.line,tour=duty.tour,trip=duty.trip,trip_name=duty.trip_name,terminus=duty.terminus,delay=duty.delay,at_stop=duty.at_stop,trip_done=duty.trip_done,next_stop=compact(duty.next_stop),previous_stop=compact(duty.previous_stop)} or nil
  omsi.send(47851,omsi.json.encode({schema=2,kind="status",session=session,route=route,variables=v,game="openomsi",map=info.map,clock=info.clock,paused=info.paused,duty=d,position={x=x,y=y,z=z,heading=heading},distance=info.next_stop_distance,commands=true,command_result=result,files_dir=omsi.files.dir(),vehicle_number=omsi.bus.number(),vehicle={file=vehicle_file,manufacturer=info.vehicle_manufacturer,model=info.vehicle_model,present=omsi.has_vehicle()},game_version=omsi.game.version()}))
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
