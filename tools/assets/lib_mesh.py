"""Shared mesh / morph / GLB utilities for the INKVERSE asset pipeline."""
import json, math, os, struct, collections
import numpy as np

SRC = os.path.join(os.path.dirname(__file__), 'base.obj')
SRC = os.path.abspath(SRC)
YMIN = -8.1676
HEIGHT_UNITS = 16.6589
SCALE = 1.86 / HEIGHT_UNITS

def load_obj(path=SRC, groups_filter=('body','helper-tights','helper-l-eye','helper-r-eye')):
    verts=[]; uvs=[]
    faces=collections.defaultdict(list)
    cur=None
    for line in open(path):
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            uvs.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            cur=line[2:].strip()
        elif line.startswith('f ') and cur:
            f=[p.split('/') for p in line.split()[1:]]
            for i in range(1,len(f)-1):
                tri=[]
                for part in (f[0], f[i], f[i+1]):
                    vi=int(part[0])-1
                    ti=int(part[1])-1 if len(part)>1 and part[1] else 0
                    tri.append((vi,ti))
                faces[cur].append(tri)
    return np.array(verts,float), np.array(uvs,float), faces

def to_meters(p):
    p=np.asarray(p,float)
    return np.stack([p[...,0]*SCALE, (p[...,1]-YMIN)*SCALE, p[...,2]*SCALE], -1)

def smoothstep(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0+1e-12),0,1); return t*t*(3-2*t)

def gauss(x,mu,sigma):
    return np.exp(-0.5*((x-mu)/sigma)**2)

def seg_dist(points,a,b):
    a=np.asarray(a,float); b=np.asarray(b,float)
    ab=b-a; L2=ab@ab
    t=np.clip(((points-a)@ab)/(L2+1e-12),0,1)
    proj=a+t[...,None]*ab
    return np.linalg.norm(points-proj,axis=-1), proj, t

def build_stream(faces, V, UV, morph_fn):
    key_to_i={}; pos=[]; uv=[]; tris=[]
    for tri in faces:
        ids=[]
        for vi,ti in tri:
            key=(vi,ti)
            if key not in key_to_i:
                key_to_i[key]=len(pos)
                pos.append(V[vi]); uv.append(UV[ti])
            ids.append(key_to_i[key])
        tris.append(ids)
    pos=np.array(pos,float); uv=np.array(uv,float); tris=np.array(tris,np.int64)
    pos=morph_fn(pos)
    # orient faces outward relative to local body axis, then compute smooth normals
    a=pos[tris[:,0]]; b=pos[tris[:,1]]; c=pos[tris[:,2]]
    fn=np.cross(b-a,c-a)
    cen=(a+b+c)/3
    axis=np.stack([np.zeros(len(cen)), cen[:,1], np.zeros(len(cen))],1)
    inward=np.einsum('ij,ij->i', fn, cen-axis)<0
    tris[inward]=tris[inward][:,[0,2,1]]
    n=np.zeros_like(pos)
    a=pos[tris[:,0]]; b=pos[tris[:,1]]; c=pos[tris[:,2]]
    fn=np.cross(b-a,c-a)
    for k in range(3): np.add.at(n, tris[:,k], fn)
    ln=np.linalg.norm(n,axis=1,keepdims=True)
    n=np.where(ln>1e-12, n/(ln+1e-12), np.array([0,0,1.0]))
    return {'pos':pos,'uv':uv,'nrm':n,'tris':tris}

# ---------------------------------------------------------------- proportions
JOINTS_BASE = {
 'head': (0,6.975,0.161), 'head_top': (0,8.40,0.08), 'neck': (0,5.89,0.068),
 'spine1': (0,4.329,-0.071), 'spine2': (0,2.797,0.259), 'spine3': (0,1.867,0.149),
 'spine4': (0,1.187,-0.096), 'pelvis': (0,0.727,0.144),
 'clav_l': (0.266,5.191,0.694), 'clav_r': (-0.266,5.191,0.694),
 'shoulder_l': (1.677,5.246,0.146), 'shoulder_r': (-1.677,5.246,0.146),
 'elbow_l': (3.129,3.493,0.132), 'elbow_r': (-3.129,3.493,0.132),
 'wrist_l': (4.312,2.452,1.757), 'wrist_r': (-4.312,2.452,1.757),
 'hand_l': (4.5,2.15,2.35), 'hand_r': (-4.5,2.15,2.35),
 'hip_l': (1.104,0.486,0.123), 'hip_r': (-1.104,0.486,0.123),
 'knee_l': (1.581,-3.695,0.32), 'knee_r': (-1.581,-3.695,0.32),
 'ankle_l': (2.196,-7.448,-0.009), 'ankle_r': (-2.196,-7.448,-0.009),
}

def make_morph(kind):
    male = kind=='male'
    J = {k: to_meters(np.array([v]))[0] for k,v in JOINTS_BASE.items()}
    arm_scale = 1.155 if male else 1.125
    arm_r = 0.105 if male else 0.088

    def morph(p_in):
        p=to_meters(np.asarray(p_in,float)).copy()
        x,y,z=p[:,0].copy(),p[:,1].copy(),p[:,2].copy()

        # ---- arm length: scale about shoulder, weighted by proximity to arm chain
        for side,sh,el,wr in (('l',J['shoulder_l'],J['elbow_l'],J['wrist_l']),
                              ('r',J['shoulder_r'],J['elbow_r'],J['wrist_r'])):
            d1,_,_=seg_dist(p,sh,el); d2,_,_=seg_dist(p,el,wr)
            d=np.minimum(d1,d2)
            w=(1-smoothstep(arm_r*0.55,arm_r*1.15,d))*smoothstep(0.10,0.19,np.abs(x))
            f=1+(arm_scale-1)*w
            p[:,0]=sh[0]+(p[:,0]-sh[0])*f
            p[:,1]=sh[1]+(p[:,1]-sh[1])*f
            p[:,2]=sh[2]+(p[:,2]-sh[2])*f
            # slight radial thickening
            d1,proj1,t1=seg_dist(p,sh,el); d2,proj2,t2=seg_dist(p,el,wr)
            use1=d1<d2
            proj=np.where(use1[:,None],proj1,proj2)
            thick=(0.075 if male else 0.03)
            ww=(1-smoothstep(arm_r*0.6,arm_r*1.2,np.minimum(d1,d2)))*smoothstep(0.10,0.19,np.abs(x))
            p[:,0]+=(p[:,0]-proj[:,0])*thick*ww
            p[:,2]+=(p[:,2]-proj[:,2])*thick*ww
        x,y,z=p[:,0],p[:,1],p[:,2]

        # ---- shoulders
        shoulderw=smoothstep(1.33,1.50,y)*(1-smoothstep(1.66,1.80,y))*smoothstep(0.04,0.16,np.abs(x))*(1-smoothstep(0.30,0.52,np.abs(x)))
        x=x*(1+shoulderw*(0.075 if male else -0.030))
        # ---- chest / pecs.  The figure faces -Z, so "front" means z < 0.
        front = 1.0 - smoothstep(-0.075, 0.010, z)
        back = smoothstep(0.0, 0.085, z)

        chest=smoothstep(1.02,1.22,y)*(1-smoothstep(1.40,1.55,y))*front*(1-smoothstep(0.20,0.32,np.abs(x)))
        z=z*(1+chest*(0.055 if male else 0.0))
        pec=chest*gauss(np.abs(x),0.088,0.045)*(1-smoothstep(1.28,1.42,y))
        z=z-(0.020 if male else 0.0)*pec
        # ---- bust (female): two forward lobes on the front surface only
        if male:
            # a little upper-chest fullness, nothing else
            pass
        else:
            lobe = gauss(np.abs(x), 0.070, 0.045)
            bust = gauss(y, 1.320, 0.058) * lobe * front
            # a little lower-pole fullness reads better in profile than a sphere
            bust += 0.35 * gauss(y, 1.283, 0.034) * lobe * front
            cast = gauss(y, 1.246, 0.022) * lobe * front
            z = z - 0.050 * bust + 0.009 * cast
            # ribcage narrows slightly, sternum sits a touch deeper
            x = x * (1.0 - 0.030 * chest)
            z = z + 0.008 * gauss(np.abs(x), 0.0, 0.028) * front * smoothstep(1.24, 1.36, y)
        # ---- waist
        waist=gauss(y,1.20,0.10)*(1-smoothstep(0.16,0.26,np.abs(x)))
        x=x*(1+waist*(0.03 if male else -0.055))
        z=z*(1+waist*(0.01 if male else -0.02))
        # ---- hips / glutes (glutes bulge towards +Z, the back of the figure)
        hips=gauss(y,1.02,0.10)*smoothstep(0.02,0.10,np.abs(x))
        x=x*(1+hips*(-0.015 if male else 0.055))
        glute=gauss(y,0.98,0.075)*back*smoothstep(0.02,0.10,np.abs(x))
        z=z+glute*(0.004 if male else 0.030)
        # write the torso shaping back into the vertex buffer before the leg pass,
        # which operates on p directly
        p[:,0], p[:,1], p[:,2] = x, y, z

        # ---- thighs
        thigh=1-smoothstep(0.02,0.09,np.minimum(seg_dist(p,J['hip_l'],J['knee_l'])[0],seg_dist(p,J['hip_r'],J['knee_r'])[0]))
        thigh*=smoothstep(0.55,0.85,y)
        for hip,knee in ((J['hip_l'],J['knee_l']),(J['hip_r'],J['knee_r'])):
            d,proj,t=seg_dist(p,hip,knee)
            w=(1-smoothstep(0.06,0.115,d))*(0.045 if male else 0.02)
            p[:,0]+=(p[:,0]-proj[:,0])*w; p[:,2]+=(p[:,2]-proj[:,2])*w
        x,y,z=p[:,0],p[:,1],p[:,2]
        # ---- head size (slightly smaller, more athletic proportions)
        headscale=0.955 if male else 0.935
        hy=J['neck'][1]+0.02
        hw=smoothstep(hy,hy+0.10,y)
        x=x*(1+(headscale-1)*hw)
        y=hy+(y-hy)*(1+(headscale-1)*hw)
        z=z*(1+(headscale-1)*hw)
        # ---- neck
        neckw=smoothstep(1.50,1.60,y)*(1-smoothstep(1.66,1.75,y))*(1-smoothstep(0.09,0.14,np.abs(x)))
        x=x*(1+neckw*(0.10 if male else -0.045)); z=z*(1+neckw*(0.04 if male else -0.02))
        # ---- jaw
        jaw=gauss(y,1.705,0.032)*smoothstep(-0.01,0.04,z)*(1-smoothstep(0.055,0.085,np.abs(x)))
        x=x*(1+jaw*(0.05 if male else -0.035))
        return np.stack([x,y,z],1)
    return morph

def default_length(p):
    # ensure exact 1.86m height with feet on the ground
    return p
