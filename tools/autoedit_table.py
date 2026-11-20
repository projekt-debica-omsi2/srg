"""Read and write native AutoEdit Paradox tables, with structural readback."""
import struct, math
class Table:
 def __init__(self,p):
  self.path=p;self.data=p.read_bytes();b=self.data
  self.rs,self.hs=struct.unpack_from('<HH',b);self.bs=b[5]*1024;self.fields=[tuple(b[120+2*i:122+2*i]) for i in range(struct.unpack_from('<H',b,33)[0])]
  assert sum(s for t,s in self.fields)==self.rs
  self.rows=[]
  for a in range(self.hs,len(b),self.bs):
   used=struct.unpack_from('<h',b,a+4)[0];n=used//self.rs+1 if used>=0 else 0
   assert n*self.rs<=self.bs-6
   self.rows.extend(bytearray(b[a+6+j*self.rs:a+6+(j+1)*self.rs]) for j in range(n))
  assert len(self.rows)==struct.unpack_from('<I',b,6)[0]
 def bounds(self,i):return sum(s for t,s in self.fields[:i]),self.fields[i]
 def get(self,row,i):
  p,(t,s)=self.bounds(i);b=bytearray(row[p:p+s])
  if t==1:return b.split(b'\0')[0].decode('cp1250')
  if t in (4,22):return int.from_bytes(b,'big')-2**31
  if t==6:
   if not any(b):return None
   if b[0]&128:b[0]^=128
   else:b=bytearray(x^255 for x in b)
   v=struct.unpack('>d',b)[0];return v if math.isfinite(v) else None
  return bytes(b)
 def set(self,row,i,v):
  p,(t,s)=self.bounds(i)
  if v is None:b=bytes(s)
  elif t==1:
   b=v.encode('cp1250');assert len(b)<=s,(v,s);b=b.ljust(s,b'\0')
  elif t in (4,22):b=(int(v)+2**31).to_bytes(s,'big')
  elif t==6:
   b=bytearray(struct.pack('>d',float(v)))
   if b[0]&128:b=bytearray(x^255 for x in b)
   else:b[0]^=128
  else:b=bytes(v)
  assert len(b)==s;row[p:p+s]=b
 def write(self):
  cap=(self.bs-6)//self.rs;n=(len(self.rows)+cap-1)//cap;h=bytearray(self.data[:self.hs])
  struct.pack_into('<I',h,6,len(self.rows))
  for off,val in [(10,n),(12,n),(14,1 if n else 0),(16,n),(58,n)]:struct.pack_into('<H',h,off,val)
  if self.fields[0][0]==22:struct.pack_into('<I',h,73,max(int(self.get(r,0)) for r in self.rows))
  result=h
  for i in range(n):
   group=self.rows[i*cap:(i+1)*cap];b=bytearray(self.bs);struct.pack_into('<HHh',b,0,i+2 if i+1<n else 0,i if i else 0,(len(group)-1)*self.rs)
   b[6:6+len(group)*self.rs]=b''.join(group);result+=b
  self.path.write_bytes(result)
  check=Table(self.path);assert check.rows==self.rows
