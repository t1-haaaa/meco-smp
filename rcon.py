#!/usr/bin/env python3
import socket, struct, sys

def read_exact(sock, n):
    data=b''
    while len(data)<n:
        c=sock.recv(n-len(data))
        if not c: raise EOFError
        data+=c
    return data

def pkt(rid,t,b):
    p=struct.pack('<ii',rid,t)+b.encode()+b'\x00\x00'
    return struct.pack('<i',len(p))+p

def rp(sock):
    h=read_exact(sock,4); ln=struct.unpack('<i',h)[0]
    d=read_exact(sock,ln); rid,t=struct.unpack('<ii',d[:8])
    return d[8:-2].decode('utf-8','replace')

def main():
    if len(sys.argv) < 2:
        print('usage: rcon.py <command>'); return 1
    cmd = sys.argv[1]
    try:
        s=socket.create_connection(('127.0.0.1',25575),timeout=5)
        s.sendall(pkt(1,3,'jTsTzPzgZxD0DGOL'))
        rp(s)
        s.sendall(pkt(2,2,cmd))
        s.settimeout(3)
        out=[]
        try:
            while True:
                b=rp(s)
                if b.strip(): out.append(b)
        except (socket.timeout,EOFError): pass
        s.close()
        print('\n'.join(out))
        return 0
    except Exception as e:
        print('RCON_ERROR: '+str(e)); return 1

if __name__=='__main__':
    sys.exit(main())
