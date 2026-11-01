import os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

out_dir = r'e:\web\落第\output\imagegen\erlands-turning-point'
os.makedirs(out_dir, exist_ok=True)

orig_top = Image.open(os.path.join(out_dir, 'orig_top.png')).convert('L')
young_bot = Image.open(r'C:\Users\eriri\.gemini\antigravity\brain\c4babd2b-a516-4975-99b9-ed3c54b390dc\young_erlands_bottom_panel_1793363210316.jpg').convert('L')
erlands_src = Image.open(r'e:\web\落第\output\imagegen\edelweiss-jeans\source\expanded-candidates\落第骑士英雄谭 - 18\190221.jpg').convert('L')

SCALE = 2
W = 710 * SCALE       # 1420
H_FULL = 1024 * SCALE # 2048
TOP_Y0, TOP_Y1 = 87 * SCALE, 456 * SCALE     # 738
BOT_Y0, BOT_Y1 = 567 * SCALE, 951 * SCALE    # 768
TOP_H = TOP_Y1 - TOP_Y0
BOT_H = BOT_Y1 - BOT_Y0

# 1. Clean room background
top_2x = np.array(orig_top.resize((W, TOP_H), Image.Resampling.LANCZOS), dtype=np.float32)
bg_top = top_2x.copy()

for y in range(TOP_H):
    left_val = np.median(top_2x[y, 140:260])
    right_val = np.median(top_2x[y, 1055:1110])
    x_start, x_end = 260, 1055
    for x in range(x_start, x_end):
        t = (x - x_start) / float(x_end - x_start)
        t_smooth = t * t * (3 - 2 * t)
        base = left_val * (1 - t_smooth) + right_val * t_smooth
        if y >= 385:
            if x < 1010:
                ref_x = 80 + ((x - x_start) % 160)
                tex_diff = top_2x[y, ref_x] - np.median(top_2x[y, 60:240])
                base = np.clip(base + tex_diff * 0.85, 0, 255)
            else:
                base = np.median(top_2x[y, 1045:1085])
        bg_top[y, x] = base

bg_blur = np.array(Image.fromarray(bg_top.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=2.5)), dtype=np.float32)
blend_zone = np.zeros((TOP_H, W), dtype=np.float32)
blend_zone[:, 260:1055] = 1.0
blend_zone = np.array(Image.fromarray((blend_zone * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=10.0)), dtype=np.float32) / 255.0
bg_top_arr = top_2x * (1.0 - blend_zone) + bg_blur * blend_zone

# 2. Exact segmentation of Professor Erlands + his armchair (reading coordinates from erlands_grid.jpg: y=600..660 is chair top, y=460..580 is his head!)
erlands_w, erlands_h = erlands_src.size
mask_solo = Image.new('L', (erlands_w, erlands_h), 0)
draw_s = ImageDraw.Draw(mask_solo)

solo_poly = [
    (60, 1500), (60, 1320), (88, 1180), (145, 1090), (178, 1050),
    (200, 940), (225, 835),
    # Left white rim of armchair wing (y=612..835)
    (206, 700), (198, 635), (212, 610), (255, 604),
    # Dip of armchair back between left wing and Erlands's left ear (y=632 -> 608)
    (312, 632), (375, 620), (446, 605),
    # Erlands's left ear & bald dome (y=580 -> 455 -> 585)
    (430, 578), (448, 545), (452, 515), (475, 485), (525, 462),
    (585, 454), (645, 456), (710, 480), (762, 518), (795, 558), (802, 588),
    # Right wing of armchair back (y=588 -> 675)
    (855, 592), (945, 612), (1025, 640), (1120, 675),
    (1120, 1600), (50, 1600)
]
draw_s.polygon(solo_poly, fill=255)
mask_solo = mask_solo.filter(ImageFilter.GaussianBlur(radius=2.5))

def compose_top_panel(crop_y0=420, crop_y1=1460):
    crop_h = crop_y1 - crop_y0
    scale_f = TOP_H / float(crop_h)
    new_w = int(erlands_w * scale_f)

    er_crop = erlands_src.crop((0, crop_y0, erlands_w, crop_y1)).resize((new_w, TOP_H), Image.Resampling.LANCZOS)
    m_crop = mask_solo.crop((0, crop_y0, erlands_w, crop_y1)).resize((new_w, TOP_H), Image.Resampling.LANCZOS)

    er_arr = np.array(er_crop, dtype=np.float32)
    m_arr = np.array(m_crop, dtype=np.float32) / 255.0

    yy, xx = np.mgrid[0:TOP_H, 0:new_w]
    xn = xx / float(new_w)
    yn = yy / float(TOP_H)

    right_feather = np.clip((0.98 - xn) / 0.12, 0.0, 1.0)
    left_feather = np.clip((xn - 0.03) / 0.06, 0.0, 1.0)
    m_arr = m_arr * right_feather * left_feather

    # Match Mushoku Tensei top panel lighting
    light_map = 0.45 + 0.43 * (xn ** 1.15) * (1.0 - 0.35 * yn)
    bottom_vig = np.clip(1.0 - 0.65 * np.maximum(0, (yn - 0.48) / 0.52) ** 1.4, 0.25, 1.0)
    top_vig = np.clip(0.72 + 0.28 * np.minimum(1.0, yn / 0.18), 0.72, 1.0)

    lit_er = er_arr * light_map * bottom_vig * top_vig
    ink_mask = np.clip((130.0 - er_arr) / 130.0, 0.0, 1.0)
    lit_er = lit_er * (1.0 - 0.55 * ink_mask) + (er_arr * 0.26) * (0.55 * ink_mask)
    lit_er = np.clip(lit_er, 10, 235)

    er_center_in_crop = int(0.56 * new_w)
    target_center_x = int(W * 0.445)
    paste_x = target_center_x - er_center_in_crop

    comp = bg_top_arr.copy()

    # Soft cast shadow on the wall behind the chair
    shadow_alpha = np.array(Image.fromarray((m_arr * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=30.0)), dtype=np.float32) / 255.0
    for c_x in range(new_w):
        dst_x = paste_x + c_x - 24
        if 0 <= dst_x < W:
            s_a = shadow_alpha[:, c_x] * 0.48
            comp[:, dst_x] = comp[:, dst_x] * (1.0 - s_a) + 16.0 * s_a

    # Paste lit Erlands
    for c_x in range(new_w):
        dst_x = paste_x + c_x
        if 0 <= dst_x < W:
            alpha = m_arr[:, c_x]
            comp[:, dst_x] = comp[:, dst_x] * (1.0 - alpha) + lit_er[:, c_x] * alpha

    # Restore clean light orbs on far left and desk
    particles = np.maximum(0, top_2x - bg_top_arr)
    part_mask = ((np.arange(W)[None, :] < 240) | (np.arange(W)[None, :] > 1060)).astype(np.float32)
    comp = np.clip(comp + particles * part_mask * 0.95, 0, 255)

    return Image.fromarray(comp.astype(np.uint8))

# Version A: Full dome sitting in the chair (crop_y0=415, crop_y1=1450)
top_solo = compose_top_panel(crop_y0=415, crop_y1=1450)
# Version B: Like Oldeus in Mushoku Tensei, top frame cuts across his forehead/glasses (crop_y0=495, crop_y1=1460)
top_closeup = compose_top_panel(crop_y0=495, crop_y1=1460)

yb_w, yb_h = young_bot.size
target_ratio = W / float(BOT_H)
crop_w = int(yb_h * target_ratio)
x0 = (yb_w - crop_w) // 2
bot_panel_young = young_bot.crop((x0, 0, x0 + crop_w, yb_h)).resize((W, BOT_H), Image.Resampling.LANCZOS)
bot_arr = np.clip(np.array(bot_panel_young, dtype=np.float32) * 0.95 + 4, 10, 248)
bot_panel_young = Image.fromarray(bot_arr.astype(np.uint8))

def assemble_full(top_img, bot_img, filename):
    canvas = Image.new('L', (W, H_FULL), 0)
    canvas.paste(top_img, (0, TOP_Y0))
    canvas.paste(bot_img, (0, BOT_Y0))
    out_path = os.path.join(out_dir, filename)
    canvas.save(out_path)
    print('Saved:', out_path)

assemble_full(top_solo, bot_panel_young, 'turning_point_erlands_final.png')
assemble_full(top_closeup, bot_panel_young, 'turning_point_erlands_closeup_final.png')
