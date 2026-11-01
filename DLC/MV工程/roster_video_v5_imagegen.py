"""V5 arena compositor with the approved high-resolution transparent portraits.

Public interface remains roster_frame(background_bgr, characters, target_time_seconds).
The original moving stage, display geometry, names and crest come from V5.
"""
from pathlib import Path
from functools import lru_cache

import cv2
import numpy as np
from PIL import Image

import roster_video_v5 as base

ASSETS=Path(__file__).resolve().parent/'素材/v5/imagegen'


@lru_cache(maxsize=8)
def _portrait(key):
    key='toka' if key=='touka' else key
    rgba=np.array(Image.open(ASSETS/f'{key}.png').convert('RGBA'))
    rgb=rgba[:,:,:3].astype(np.float32)
    alpha=rgba[:,:,3].astype(np.float32)/255
    # These are already transparent cutouts. No paper/skin colour classification.
    # A two-high-resolution-pixel inward contour suppresses residual edge bleed.
    kernel=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5))
    alpha=cv2.erode(alpha,kernel)
    alpha=np.minimum(alpha,cv2.GaussianBlur(alpha,(3,3),.45))
    gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
    blue=np.stack([gray*.79+9,gray*.91+15,gray*.98+21],axis=2)
    rgb=np.clip(rgb*.76+blue*.24,0,255).astype(np.uint8)
    return np.dstack([cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),
                     (alpha*255).astype(np.uint8)])


# V5's renderer looks up this function at call time. Its premultiplied resize
# and perspective warp, placement and all original-stage behaviour stay intact.
base._portrait=_portrait
roster_frame=base.roster_frame
