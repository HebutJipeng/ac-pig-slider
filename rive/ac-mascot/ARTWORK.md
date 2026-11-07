# AC 娘原画分层角色（v2）

v2 使用已经确认并公开的 `public/portraits/original.webp` 和 `pig.webp` 作为底图，保留人物比例、头发、眼睛、衣服、配件和背景。未改动这两张图，也未使用 `assets/imgs` 中的用户参考原件。

v3 嘴部采用原图像素与重新生成的透明嘴型图集，已移除 v2 的矢量嘴巴。静止时不覆盖原图嘴部；说话时才启用局部修补图层，并选择闭嘴、小张口、张口和哼唧嘴型。可爱态的大张口和小猪态闭嘴使用原图本身的嘴部。眼睛通过局部闭眼修补图层完成眨眼。修补图像只显示在嘴或眼睛的裁剪区域，不替换整个原画。保留 Character 状态机与 pig、human、mouthOpen、mouthWide、embarrassed、ready 数据契约。

- 可编辑源文件：`scene.rml`
- 图层素材：`assets/cute-neutral-v2.webp`、`assets/pig-neutral-v2.webp`
- 网页资源：`../../public/rive/ac-mascot.riv`
- 素材生成方式：内置 image_gen 编辑工具；WebP 仅作格式压缩。
- 生成的完整 PNG 保存在项目的 `assets/generated/rive-v2/`（不发布）。

## 可爱态编辑提示词

Use case: precise-object-edit. Edit target: the attached approved AC娘 illustration, for a layered Rive animation asset. Preserve the EXACT same character, composition, crop, head size, hair strands, orange hair highlights, red A and C buns, blue ribbons, sailor uniform, yellow scarf, background, skin shading and blush. Change ONLY two tiny facial details: (1) close both eyes into relaxed happy curved eyelids with delicate original-style brown eyelashes, in their current eye locations; (2) erase the open mouth completely and replace it with smooth uninterrupted matching cheek/chin skin (NO mouth or lips at all). Keep the nose, eyebrows, blush and face contour identical. It should look like exactly the same illustration with eyes closed and a blank mouth region, not a redraw or a vector simplification. No text, no added objects. Square image matching original framing exactly.

## 小猪态编辑提示词

Use case: precise-object-edit. Edit target: the attached approved AC娘 in cute pig outfit illustration, for a layered Rive animation rig. Preserve the EXACT same character, composition, crop, head angle and size, orange hair highlights and strands, red A and C buns, blue ribbons, pink pig outfit with floppy ears, paws, zipper charm, blue background and pink hearts. Keep the pink pig nose completely identical and with NO straps. Change ONLY these tiny facial details: (1) close both eyes into relaxed sly curved eyelids with delicate original-style brown eyelashes, keeping the same eye positions and tilted orientation; (2) erase the small wavy mouth completely and fill the mouth area with uninterrupted matching skin (no mouth, no lips). Keep all nose details, eyebrows, blush and face contour identical. Match original illustration shading and brush style, no flat vector simplification, no redesign, no text. Square image, original framing.

## v3 嘴型素材

使用内置 image_gen，分别以已确认的可爱态和小猪态原图为参考，生成 2×2 透明嘴型图集。源文件是 `assets/cute-mouths-v3.webp` 与 `assets/pig-mouths-v3.webp`；完整生成 PNG 保存在项目 `assets/generated/rive-v3/`，不发布。WebP 为无损格式转换，图集在 Rive 内裁剪并按透明像素边界定位。

新增 talking、mouthClosed、mouthSmall、mouthFull、mouthRound 数值属性；四种嘴型互斥。嘴型切换跟随音频时钟中的音量，停止时清除 talking，恢复原图嘴部。原 mouthOpen、mouthWide 属性保留兼容。

### 可爱态提示词

Generate only four isolated mouth sprites for the approved AC娘 illustration on a transparent 2×2 square sheet. Match the reference mouth: delicate warm brown fine contour, almost straight slightly angled upper edge, tiny off-white upper teeth, softly painted coral-pink tongue, peach highlights, rosy shading, rounded tapered lower contour. Cells: closed gentle smile, small half-open smile, exact reference open smile, restrained rounded/pursed mouth. No face, skin, labels, lipstick, thick outlines or generic cartoon styling. Preserve original painted anime brush texture.

### 小猪态提示词

Generate only four tiny expressive mouth sprites for the approved AC娘 pig illustration on a transparent 2×2 square sheet. Preserve the delicate W/omega-shaped upper contour, thin warm brown line and tiny smug expression. Cells: original closed wavy smile, same smile with a very small center opening, slightly open W mouth with muted coral interior and tiny peach tongue, tiny pursed 哼唧 bean-shaped opening. No teeth, large laughing smile, shocked O, face, nose, skin or labels. Match original anime brushwork and palette.

## 嚣张重生独立答辩

原画为公开的 `public/portraits/reborn.webp`，未修改原图。新增 `reborn` 属性与独立图层，左侧（小于 −7.5）显示重生原画；中间显示 human，右侧显示 pig，三者互斥。

素材：`assets/reborn-neutral-v4.webp`、`assets/reborn-mouths-v4.webp`，通过内置 image_gen 编辑/生成。静止与大张口继续使用原图坏笑像素。完整 PNG 保存在项目 `assets/generated/rive-reborn/`，不发布。

修补提示词：以重生 AC 娘原图为编辑目标，只闭眼并移除嘴部，保留嚣张眉眼、脸型、香蕉皇冠、权杖、金色披风、光环、服务器和完整构图。原画细节与画风不变。

嘴型提示词：以原图的倾斜露齿坏笑为参考，在透明 2×2 图集中生成闭嘴坏笑、略微张口露齿、原图露齿笑和小幅张口四种嘴型；细暖棕描边、米白牙齿、轻灰阴影和暗珊瑚口腔，不改成甜美可爱态或惊讶圆嘴，无脸、皮肤、标签或文字。
