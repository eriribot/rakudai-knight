"""Motion-preserving, cut-bounded propagation of externally repaired video frames.

    repaired = propagate(frames_bgr, {key_idx: repaired_bgr})

All arrays must be uint8 BGR of the same size. Anchor indices are local to the
supplied sequence. Output has the same length, shape and order. This module
loads no models, writes no files, and does not change shot timing.

Only original video frames drive optical flow. Each target pixel is traced
back to an anchor through bidirectionally checked adjacent flows; a single
resampling of its repair residual avoids accumulating image blur. Occluded,
out-of-bounds, newly exposed and poorly registered pixels retain the original.
Explicit cut_indices (the first frame of each new shot) are recommended when
known; automatic cut detection is deliberately conservative.
"""
from __future__ import annotations

from functools import lru_cache
import math
import cv2
import numpy as np


def _gray(image):
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _sample(image, xy, border=cv2.BORDER_CONSTANT):
    return cv2.remap(image, xy[..., 0], xy[..., 1], cv2.INTER_LINEAR,
                     borderMode=border, borderValue=0)


def _correlation(a, b, mask=None):
    a=a.astype(np.float32); b=b.astype(np.float32)
    if mask is not None:
        a=a[mask]; b=b[mask]
    a=a-a.mean(); b=b-b.mean()
    return float(np.sum(a*b)/(np.sqrt(np.sum(a*a)*np.sum(b*b))+1e-8))


def _valid_affine(matrix, width, height):
    if not np.isfinite(matrix).all():
        return False
    linear=matrix[:, :2]
    scales=np.linalg.svd(linear, compute_uv=False)
    rotation=math.degrees(math.atan2(linear[1, 0], linear[0, 0]))
    shear=abs(float(np.dot(linear[:, 0], linear[:, 1])))
    return (np.linalg.det(linear)>0 and np.min(scales)>=.95
            and np.max(scales)<=1.05 and abs(rotation)<=3.5 and shear<.04
            and abs(matrix[0, 2])<=width*.05
            and abs(matrix[1, 2])<=height*.05)


def _register(original, repaired, small_size, tone_match):
    """Return aligned residual, registration support, and a small status dict."""
    h,w=original.shape[:2]; sw,sh=small_size
    source=cv2.resize(_gray(original), small_size, interpolation=cv2.INTER_AREA)
    repair=cv2.resize(_gray(repaired), small_size, interpolation=cv2.INTER_AREA)
    a=cv2.GaussianBlur(source, (5,5), 1.2)
    b=cv2.GaussianBlur(repair, (5,5), 1.2)
    identity=np.eye(2,3,dtype=np.float32)
    initial=identity.copy(); feature_quality=False
    # Feature registration supplies a bounded initial estimate; ECC refines it.
    orb=cv2.ORB_create(nfeatures=1400, fastThreshold=9)
    ka,da=orb.detectAndCompute(a,None); kb,db=orb.detectAndCompute(b,None)
    if da is not None and db is not None:
        pairs=cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da,db,k=2)
        good=[p[0] for p in pairs if len(p)==2 and p[0].distance<.75*p[1].distance]
        if len(good)>=10:
            pa=np.float32([ka[m.queryIdx].pt for m in good])
            pb=np.float32([kb[m.trainIdx].pt for m in good])
            estimate,inliers=cv2.estimateAffinePartial2D(
                pa,pb,method=cv2.RANSAC,ransacReprojThreshold=2.0,
                maxIters=1500,confidence=.99)
            if (estimate is not None and inliers is not None
                    and inliers.sum()>=8 and inliers.mean()>=.4
                    and _valid_affine(estimate,sw,sh)):
                initial=estimate.astype(np.float32); feature_quality=True
    candidates=[('identity', identity)]
    if feature_quality:
        candidates.append(('features',initial))
    try:
        _,ecc=cv2.findTransformECC(
            a.astype(np.float32)/255,b.astype(np.float32)/255,
            initial.copy(),cv2.MOTION_AFFINE,
            (cv2.TERM_CRITERIA_COUNT|cv2.TERM_CRITERIA_EPS,65,1e-5),
            None,5)
        if _valid_affine(ecc,sw,sh):
            candidates.append(('ECC',ecc))
    except cv2.error:
        pass
    # Judge alignment at coarse structure scale so sharpening itself is not
    # mistaken for geometry drift. Identity is not an unconditional fallback.
    best=None
    for method,matrix in candidates:
        aligned=cv2.warpAffine(b,matrix,small_size,
            flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP)
        valid=cv2.warpAffine(np.ones((sh,sw),np.float32),matrix,small_size,
            flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP)>.99
        valid[:5]=False;valid[-5:]=False;valid[:,:5]=False;valid[:,-5:]=False
        if valid.sum()<100:
            continue
        score=_correlation(a,aligned,valid)
        if best is None or score>best[0]:
            best=(score,method,matrix,valid,aligned)
    if best is None or best[0]<.55:
        return None,None,{'accepted':False,'reason':'registration/structure mismatch',
            'correlation':None if best is None else round(best[0],4)}
    score,method,matrix,valid,aligned=best
    # Convert the original->repair sampling affine from flow scale to full size.
    s=np.diag([sw/w,sh/h,1.0]).astype(np.float32)
    full=np.linalg.inv(s)@np.vstack([matrix,[0,0,1]])@s
    registered=cv2.warpAffine(repaired,full[:2],(w,h),
        flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP).astype(np.float32)
    if tone_match:
        # A restrained per-channel offset preserves the source's overall grade.
        # No contrast/saturation boosting is introduced by the propagator.
        mask=cv2.resize(valid.astype(np.uint8),(w,h),interpolation=cv2.INTER_NEAREST)>0
        offset=np.median(registered[mask]-original[mask].astype(np.float32),axis=0)
        registered=np.clip(registered-np.clip(offset,-24,24),0,255)
    # Local coarse NCC gates non-affine redrawing. Textureless matching regions
    # may pass photometric agreement, but visibly shifted anatomy does not.
    af=a.astype(np.float32); bf=aligned.astype(np.float32)
    mean_a=cv2.boxFilter(af,-1,(17,17)); mean_b=cv2.boxFilter(bf,-1,(17,17))
    var_a=np.maximum(cv2.boxFilter(af*af,-1,(17,17))-mean_a*mean_a,0)
    var_b=np.maximum(cv2.boxFilter(bf*bf,-1,(17,17))-mean_b*mean_b,0)
    cov=cv2.boxFilter(af*bf,-1,(17,17))-mean_a*mean_b
    ncc=cov/np.sqrt(var_a*var_b+1)
    texture=(var_a>30)&(var_b>30)
    support=np.where(texture,np.clip((ncc-.30)/.45,0,1),
                     np.clip(1-np.abs(mean_a-mean_b)/38,0,1)).astype(np.float32)
    support*=valid
    support=cv2.erode(support,np.ones((3,3),np.uint8))
    support=cv2.GaussianBlur(support,(3,3),.6)
    return registered-original.astype(np.float32),support,{
        'accepted':True,'method':method,'correlation':round(score,4),
        'affine_original_to_repair':full[:2].tolist()}


def _automatic_cuts(small_frames):
    if len(small_frames)<2:
        return set()
    thumbs=[cv2.resize(f,(96,54),interpolation=cv2.INTER_AREA) for f in small_frames]
    changes=[float(np.mean(np.abs(a.astype(np.float32)-b)))
             for a,b in zip(thumbs,thumbs[1:])]
    baseline=float(np.median(changes))
    result=set()
    for i,(a,b,mad) in enumerate(zip(thumbs,thumbs[1:],changes),1):
        ha=cv2.calcHist([a],[0,1,2],None,[8,8,8],[0,256]*3)
        hb=cv2.calcHist([b],[0,1,2],None,[8,8,8],[0,256]*3)
        cv2.normalize(ha,ha,1,0,cv2.NORM_L1)
        cv2.normalize(hb,hb,1,0,cv2.NORM_L1)
        histogram=cv2.compareHist(ha,hb,cv2.HISTCMP_BHATTACHARYYA)
        structure=_correlation(_gray(a),_gray(b))
        if ((mad>30 and histogram>.48) or (mad>55 and structure<.25)
                or (mad>max(24,baseline*3.2) and structure<.45)):
            result.add(i)
    return result


def propagate(frames_bgr, anchors_dict, *, max_distance=12, cut_indices=None,
              flow_width=640, tone_match=True, diagnostics=None, detect_cuts=True):
    """Return repaired BGR frames without changing the original motion/timing.

    anchors_dict maps local frame indices to same-size uint8 BGR image arrays.
    max_distance limits propagation to either side of each anchor (default 12).
    cut_indices optionally declares first-frame indices of new shots, in
    addition to automatic cuts. Set max_distance=0 to process anchors only.
    detect_cuts=False disables automatic cuts for an already known continuous
    shot; explicit cut_indices and all optical-flow confidence gates still apply.
    flow_width caps the optical-flow resolution, preserving aspect ratio.
    diagnostics, when a dict is supplied, receives rejected-anchor reasons and
    detected/explicit cuts. Rejected anchors silently leave source pixels intact.

    Memory is bounded by the input/output sequence and low-resolution flow pairs;
    full-resolution residuals are stored only for the supplied repair anchors.
    """
    frames=list(frames_bgr)
    if not frames:
        if anchors_dict:
            raise ValueError('Cannot supply anchors for an empty sequence')
        return []
    if not isinstance(max_distance,int) or max_distance<0:
        raise ValueError('max_distance must be a nonnegative integer')
    shape=frames[0].shape
    if len(shape)!=3 or shape[2]!=3 or min(shape[:2])<24:
        raise ValueError('Frames must be BGR images at least 24x24')
    for frame in frames:
        if frame.shape!=shape or frame.dtype!=np.uint8:
            raise ValueError('All source frames must be same-size uint8 BGR')
    anchors={}
    for index,anchor in anchors_dict.items():
        if not isinstance(index,(int,np.integer)) or not 0<=int(index)<len(frames):
            raise ValueError(f'Invalid local anchor index: {index!r}')
        if anchor.shape!=shape or anchor.dtype!=np.uint8:
            raise ValueError(f'Anchor {index} must match the source size and uint8 BGR type')
        anchors[int(index)]=anchor
    if not anchors:
        return [f.copy() for f in frames]
    h,w=shape[:2]
    scale=min(1.0,max(64,int(flow_width))/w)
    sw=max(24,round(w*scale));sh=max(24,round(h*scale));size=(sw,sh)
    small=[cv2.resize(f,size,interpolation=cv2.INTER_AREA) for f in frames]
    gray=[_gray(f) for f in small]
    cuts=_automatic_cuts(small) if detect_cuts else set()
    if cut_indices is not None:
        for index in cut_indices:
            if not isinstance(index,(int,np.integer)) or not 0<int(index)<len(frames):
                raise ValueError('cut_indices must contain new-shot frame indices inside the sequence')
            cuts.add(int(index))
    segments=np.cumsum([int(i in cuts) for i in range(len(frames))])
    prepared={}; statuses={}
    for index,anchor in sorted(anchors.items()):
        residual,support,status=_register(frames[index],anchor,size,tone_match)
        statuses[index]=status
        if residual is not None:
            prepared[index]=(residual,support)
    if diagnostics is not None:
        diagnostics.update({'anchors':statuses,'cuts':sorted(cuts),'max_distance':max_distance,
                            'flow_size':[sw,sh],'flow_pairs_computed':0})
    if not prepared:
        return [f.copy() for f in frames]
    yy,xx=np.mgrid[:sh,:sw].astype(np.float32)
    grid=np.dstack([xx,yy])
    dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM) if hasattr(cv2,'DISOpticalFlow_create') else None
    if dis is not None:
        dis.setUseSpatialPropagation(True)

    def calc(a,b):
        if dis is not None:
            return dis.calc(a,b,None)
        return cv2.calcOpticalFlowFarneback(a,b,None,.5,4,21,4,7,1.5,0)

    def consistency(flow,reverse,a,b):
        landing=grid+flow
        reverse_at_landing=_sample(reverse,landing)
        error=np.linalg.norm(flow+reverse_at_landing,axis=2)
        motion=np.linalg.norm(flow,axis=2)
        allowed=.8+.035*motion
        confidence=np.exp(-.5*(error/allowed)**2).astype(np.float32)
        confidence[error>2.5*allowed]=0
        valid=(landing[...,0]>=1)&(landing[...,0]<sw-2)&(landing[...,1]>=1)&(landing[...,1]<sh-2)
        warped=_sample(b.astype(np.float32),landing)
        difference=np.abs(a.astype(np.float32)-warped)
        confidence*=np.exp(-np.maximum(difference-12,0)/28)*valid
        # Conservative one-pixel erosion prevents unreliable occlusion borders
        # from bleeding their anchor colours onto newly revealed surfaces.
        return cv2.erode(confidence,np.ones((3,3),np.uint8))

    @lru_cache(maxsize=96)
    def pair(index):
        forward=calc(gray[index],gray[index+1])
        backward=calc(gray[index+1],gray[index])
        cf=consistency(forward,backward,gray[index],gray[index+1])
        cb=consistency(backward,forward,gray[index+1],gray[index])
        if diagnostics is not None:
            diagnostics['flow_pairs_computed']+=1
        return forward,backward,cf,cb

    def trace(target,anchor):
        xy=grid.copy(); confidence=np.ones((sh,sw),np.float32)
        step=1 if anchor>target else -1
        for current in range(target,anchor,step):
            f,b,cf,cb=pair(current if step==1 else current-1)
            flow,conf=(f,cf) if step==1 else (b,cb)
            confidence*=_sample(conf,xy)
            xy+=_sample(flow,xy)
            confidence*=((xy[...,0]>=0)&(xy[...,0]<sw-1)
                         &(xy[...,1]>=0)&(xy[...,1]<sh-1))
        return xy,confidence

    output=[]
    for target,source in enumerate(frames):
        relevant=[i for i in prepared if abs(i-target)<=max_distance and segments[i]==segments[target]]
        if not relevant:
            output.append(source.copy());continue
        numerator=np.zeros(shape,np.float32)
        denominator=np.zeros((h,w),np.float32)
        strongest=np.zeros((h,w),np.float32)
        for anchor in relevant:
            residual,support=prepared[anchor]
            xy,confidence=trace(target,anchor)
            confidence*=_sample(support,xy)
            # No weak-flow smear: insufficient confidence fades back to source.
            confidence=np.clip((confidence-.22)/.58,0,1)
            distance=abs(anchor-target)
            temporal=1.0 if not distance else math.exp(-.5*(distance/max(max_distance*.8,1))**2)
            weight=cv2.resize(confidence,(w,h),interpolation=cv2.INTER_LINEAR)
            weight*=temporal
            # Pixel-center-correct conversion between OpenCV resize grids.
            xy_full=cv2.resize(xy,(w,h),interpolation=cv2.INTER_LINEAR)
            xy_full[...,0]=(xy_full[...,0]+.5)*w/sw-.5
            xy_full[...,1]=(xy_full[...,1]+.5)*h/sh-.5
            repaired_delta=_sample(residual,xy_full)
            numerator+=repaired_delta*weight[...,None]
            denominator+=weight
            strongest=np.maximum(strongest,weight)
        blended=np.divide(numerator,denominator[...,None],out=np.zeros_like(numerator),
                          where=denominator[...,None]>1e-6)
        output.append(np.clip(source.astype(np.float32)+blended*strongest[...,None],0,255).astype(np.uint8))
    return output
