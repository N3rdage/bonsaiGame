import subprocess, re, sys
def show(ref):
    return subprocess.run(['git','show',ref+':ARCHITECTURE.md'],capture_output=True,text=True).stdout.split('\n')
b=show('8d3f2f1'); o=show('HEAD'); t=show('origin/main')
key='- **`src/world3d/` is derived'
idx=lambda L:[i for i,l in enumerate(L) if l.startswith(key)][0]
lb,lo,lt=b[idx(b)],o[idx(o)],t[idx(t)]
tok=lambda s:re.findall(r'\S+|\s+',s)
for n,s in (('b',lb),('o',lo),('t',lt)):
    open('.scratch/w'+n,'w').write('\n'.join(tok(s))+'\n')
r=subprocess.run(['git','merge-file','-p','.scratch/wo','.scratch/wb','.scratch/wt'],capture_output=True,text=True)
print('conflicts:',r.returncode, file=sys.stderr)
merged=''.join(r.stdout.split('\n')[:-1])
cur=open('ARCHITECTURE.md').read().split('\n')
s=cur.index('<<<<<<< HEAD'); e=cur.index('>>>>>>> origin/main')
cur[s:e+1]=[merged]
if r.returncode==0: open('ARCHITECTURE.md','w').write('\n'.join(cur))
