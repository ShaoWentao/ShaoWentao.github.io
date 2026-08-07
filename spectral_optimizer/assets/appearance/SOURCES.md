# Appearance image sources

餐饮模块中的图片用于视觉预览，工程反射率曲线单独维护。图片不会参与光谱反推。

## 材质图集

- `../material-texture-atlas.png`：暖橡木、深胡桃木、焦糖皮革、暖米色织物、绿色叶片、肤色样本和中性墙面的本地材质图集。

## 菜式照片

12类菜式均采用食物表面的近景局部特写。图片已按4:3近景构图下载到项目内，页面运行时不再请求第三方图片或裁切代理。

| 菜式视觉类型 | 当前局部特写 | 原始来源 | 本地图片 |
|---|---|---|---|
| 红褐酱烧肉菜 | 红烧肉局部特写 | Pexels 8256988 | `dining/dish_red_braised_meat.jpg` |
| 鲜红辣油菜式 | 水煮肉片鲜红辣油局部特写 | 凤凰网菜式图片 | `dining/dish_red_chili_oil.jpg` |
| 金黄煎炸菜式 | 炸鸡脆皮局部特写 | Pexels 11502306 | `dining/dish_golden_fried.jpg` |
| 深褐烤制肉菜 | 烧鹅烤制表皮局部特写 | Wikimedia Commons 烧鹅照片 | `dining/dish_dark_roasted_meat.jpg` |
| 橙粉鱼虾海鲜 | 三文鱼橙粉鱼肉局部特写 | Pexels 17584591 | `dining/dish_orange_pink_seafood.jpg` |
| 银白清蒸海鲜 | 清蒸鱼银灰鱼皮与白色鱼肉局部特写 | 搜狐清蒸鱼文章第3张图片（文章 613719948） | `dining/dish_silver_steamed_seafood.jpg` |
| 浅色肉类菜式 | 白切鸡浅色熟肉局部特写 | Pexels 30120279 | `dining/dish_pale_poultry.jpg` |
| 翠绿蔬菜菜式 | 炒青菜翠绿叶片局部特写 | Pexels 36108993 | `dining/dish_green_vegetable.jpg` |
| 浅色豆腐菌菇菜 | 豆腐菌菇浅色表面局部特写 | Pexels 5182122 | `dining/dish_pale_tofu_mushroom.jpg` |
| 深色菌菇酱汁菜 | 熟黑椒牛肉酱汁局部特写 | Wok and Kin 黑椒牛肉 | `dining/dish_dark_sauce_mushroom.jpg` |
| 多色综合摆盘 | 多色水果拼盘局部特写 | Pexels 34664681 | `dining/dish_multicolor_plating.jpg` |
| 汤锅与浓汤菜式 | 沸腾红油火锅局部特写 | 炉鼎技大阪心斋桥店 | `dining/dish_soup_hotpot.jpg` |

各图片的原始页面信息以 `dining-light-data.js` 中记录的 `sourcePage` 为准。使用或再发布图片时应核对对应来源页的署名和许可要求。

## 博物馆展品图

- 青花瓷单展品：本地透明底素材 `museum/qinghua-porcelain-cutout.png`，仅保留展品主体。
- 纸本水墨花鸟：朱偁纸本水墨花鸟作品图，来源于 Wikimedia Commons：`File:Zhu Cheng - A Chinese ink painting on paper by Zhu Cheng of a bird on bamboo with flowers.jpg`。作品及图像标记为公共领域，页面读取本地文件 `museum/ink-bird-bamboo.jpg`。区域处理读取本地蒙版 `museum/ink-bird-bamboo-regions.json`，以60×134的固定区域图标记纸张底色、纸张阴影、淡墨、中墨、浓墨和印章红；生成脚本为 `tools/generate-ink-region-mask.js`。
- 青铜纹饰食器：本地透明底素材 `museum/bronze-vessel-cutout.png`，由 Wikimedia Commons 的 `File:Chinese bronze vessel - British Museum (2).jpg` 抠图制作。原照片采用 CC0 1.0 公共领域贡献；页面直接读取本地透明底图，不再执行自动去背景。
- 青白玉雕件：本地透明底素材 `museum/qingbai-jade-carving-cutout.png`，由大都会艺术博物馆藏18世纪清代软玉雕文士（藏品编号 `02.18.470`）原图去除背景制作。藏品页标记为 Public Domain，原始藏品页为 `https://www.metmuseum.org/art/collection/search/43829`；页面直接读取本地透明底图，不再执行自动去背景。
- 黑漆金银莳绘砚箱：本地透明底素材 `museum/black-lacquer-gold-writing-box-cutout.png`，由大都会艺术博物馆藏日本明治时期 `Writing Box with Birdcage` 原图去除背景制作。藏品页标记为 Public Domain，原始藏品页为 `https://www.metmuseum.org/art/collection/search/58274`；页面直接读取本地透明底图，不再执行自动去背景。
- 花鸟刺绣挂屏：本地透明底素材 `museum/embroidered-birds-flowers-panel-cutout.png`，由大都会艺术博物馆藏19世纪晚期朝鲜王朝 `Birds and Flowers` 刺绣屏风局部去除背景制作。藏品页标记为 Public Domain，原始藏品页为 `https://www.metmuseum.org/art/collection/search/918072`；页面直接读取本地透明底图，不执行自动去背景，图片不用于织物反射率反推。
- 清乾隆掐丝珐琅花卉纹瓶：本地透明底素材 `museum/qing-qianlong-cloisonne-floral-vase-cutout.png`，由大都会艺术博物馆藏清乾隆时期铜胎掐丝珐琅瓶（藏品编号 `29.110.77`）原图去除背景制作。藏品页标记为 Public Domain，原始藏品页为 `https://www.metmuseum.org/art/collection/search/40732`；页面直接读取本地透明底图，不执行自动去背景，图片不用于珐琅或金属反射率反推。
- 北宋彩绘木雕观音菩萨像：本地透明底素材 `museum/northern-song-guanyin-cutout.png`，由大都会艺术博物馆藏10世纪晚期至11世纪初彩绘木雕观音菩萨像（藏品编号 `33.116`）原图去除背景制作。藏品材质包含地黄木、彩绘、鎏金、石英和红玉髓；藏品页标记为 Public Domain，原始藏品页为 `https://www.metmuseum.org/art/collection/search/42725`。页面直接读取本地透明底图，不执行自动去背景，图片不用于肤色、颜料、木质、金属或宝石反射率反推。
- 花卉与水果静物油画：本地完整画面素材 `museum/roesen-still-life-flowers-fruit.svg`，内嵌 Severin Roesen《Still Life: Flowers and Fruit》的公共领域馆方图像，保留完整画布构图与深色背景。作品约作于1850–55年，油彩画布，藏品编号 `67.111`；大都会艺术博物馆藏品页标记为 Public Domain，原始藏品页为 `https://www.metmuseum.org/art/collection/search/11938`。图片仅用于视觉展示与区域映射，油画颜料工程反射率模型单独维护，不从图像反推光谱。
- 展品图用于当前光谱与优化后光谱的视觉模拟。工程反射率模型单独维护。已配置区域蒙版的展品优先按蒙版分类；蒙版缺失、损坏或尺寸无效时回退到图片 RGB 分类。图片与蒙版均不用于反射率或光谱反推。

## 显示规则

- 缩略图、优化前预览和优化后预览使用同一张局部特写。
- 餐饮图片已在下载时裁掉完整餐盘和大部分背景，重点保留菜式表面颜色、纹理、油脂和烹饪状态。
- 页面运行时仅加载项目内图片；来源网页只用于版权和出处记录。
- 优化前预览统一使用72%饱和度；只有配方实际应用后，优化后预览才恢复原始饱和度并叠加计算得到的 Lab 差异。
- 预览处理只发生在浏览器画布中，不修改原始图片文件。
