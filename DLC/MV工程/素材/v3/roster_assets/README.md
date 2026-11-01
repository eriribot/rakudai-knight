# V3 原六边屏素材与来源

- 四个人物来自动画官网 `https://ittoshura.com/character/` 的角色设定图，原文件在 `素材/v2/portraits/`。透明 PNG 是手描轮廓遮罩，保留原 RGB 像素；无人物生成或重绘。人物原图底部印刷渐隐区另外以 alpha 收尾。
- 校徽来自 BellFine 第一方商品页：`https://bellfine.co.jp/products/characters-goods/strap-key-chain/g724405/`，商品名明确为「破軍学園校章キーホルダー」，JAN 4573347244056，版权标为《落第骑士英雄谭》动画制作委员会。保留校徽黄/金色印刷图纹，剔除白色商品底板和链条，不补画图案。
- `sources.json` 记录了原图 URL、输出图、遮罩方式和裁剪范围。工作区旧红白 `knight-shield` 与此校徽不是同一图案，未采用。

合成模块为 `MV工程/roster_video_v3.py`。接口：

```python
roster_frame(background_bgr, ['ikki', 'stella'], target_time_seconds)
roster_frame(background_bgr, ['toka', 'shizuku'], target_time_seconds)
```

`background_bgr` 必须是 **原去水印母版在绝对目标时刻的帧**，不是 V1/V2 已盖过的画面。最终连续覆盖 **11.16–13.04 秒**（25 fps 帧 279–325，末端不含）。人物整镜为 11.16–11.80 秒、12.08–12.80 秒；其中 11.80–12.08、12.80–13.04 是原徽章转场，已按原镜头逐帧旋转平面替换成真破军校徽，连画面边缘露出的徽章也纳入。范围外原样返回。底部原活动名条只擦字并写入姓名，中心只替换校徽，舞台中心光柱和物理六边边框保留。

首 0.24 秒旧人物存在双面扫描残影，所以先清空六边屏内部，按原片底向上扫描显示新人物；其余帧仅清除旧人物轮廓。旧人物遮住的玻璃光照属于局部补底。徽章内部原纹样及光晕用周围原玻璃颜色拟合清除，原六边外框和框外连接线保留。预览：`检查/v3_roster/roster_v3_draft.mp4`、`roster_contact.jpg`、`crest_transitions_contact.jpg`。
