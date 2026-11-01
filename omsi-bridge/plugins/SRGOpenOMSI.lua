-- Read-only rich telemetry, local PC only. No game controls.
local session = tostring({})
local ticks = 0
local function compact(s)
  if not s then return nil end
  return {number=s.number,name=s.name,id=s.id,arrival=s.arrival,departure=s.departure,passed=s.passed,closed=s.closed,x=s.x,y=s.y,z=s.z}
end
omsi.every(0.5, function()
  local info = omsi.info()
  local duty = omsi.duty.get()
  local route = duty and table.concat({tostring(duty.line),tostring(duty.tour),tostring(duty.trip),tostring(duty.trip_name)}, "|") or ""
  local x,y,z,heading = omsi.position()
  local v = {Velocity=omsi.speed(),IBIS_Linie=omsi.var("IBIS_Linie"),IBIS_Route=omsi.var("IBIS_Route"),IBIS_Ziel=omsi.var("IBIS_Ziel")}
  local d = duty and {line=duty.line,tour=duty.tour,trip=duty.trip,trip_name=duty.trip_name,terminus=duty.terminus,delay=duty.delay,at_stop=duty.at_stop,trip_done=duty.trip_done,next_stop=compact(duty.next_stop),previous_stop=compact(duty.previous_stop)} or nil
  omsi.send(47851,omsi.json.encode({schema=2,kind="status",session=session,route=route,variables=v,game="openomsi",map=info.map,clock=info.clock,paused=info.paused,duty=d,position={x=x,y=y,z=z,heading=heading},distance=info.next_stop_distance}))
  ticks=ticks+1
  if ticks%4==1 then
    local stops=omsi.duty.stops()
    local total=math.ceil(#stops/10)
    for part=1,total do
      local chunk={}
      for i=(part-1)*10+1,math.min(part*10,#stops) do chunk[#chunk+1]=compact(stops[i]) end
      omsi.send(47851,omsi.json.encode({schema=2,kind="stops",session=session,route=route,part=part,total=total,stops=chunk}))
    end
  end
end)
