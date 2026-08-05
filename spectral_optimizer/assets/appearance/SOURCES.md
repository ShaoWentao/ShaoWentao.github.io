# Appearance image sources

餐饮模块中的图片用于视觉预览，工程反射率曲线单独维护。图片不会参与光谱反推。

## 材质图集

- `../material-texture-atlas.png`：暖橡木、深胡桃木、焦糖皮革、暖米色织物、绿色叶片、肤色样本和中性墙面的本地材质图集。

## 菜式照片

12类菜式均采用食物表面的近景局部特写。远程图片通过 `images.weserv.nl` 统一裁切为4:3近景构图并提供跨域读取；网络不可用或图片加载失败时，自动显示项目内的本地备用图。

| 菜式视觉类型 | 当前局部特写 | 原始来源 | 本地备用图 |
|---|---|---|---|
| 红褐酱烧肉菜 | 红烧肉局部特写 | Pexels 8256988 | `foods/red-brown-cooked-meat.webp` |
| 鲜红辣油菜式 | 水煮肉片鲜红辣油局部特写 | 凤凰网菜式图片 | `foods/vivid-red-produce.webp` |
| 金黄煎炸菜式 | 炸鸡脆皮局部特写 | Pexels 11502306 | `foods/golden-baked-crust.webp` |
| 深褐烤制肉菜 | 烧鹅烤制表皮局部特写 | Wikimedia Commons 烧鹅照片 | `foods/dark-brown-roasted.webp` |
| 橙粉鱼虾海鲜 | 三文鱼橙粉鱼肉局部特写 | Pexels 17584591 | `foods/orange-pink-fish.webp` |
| 银白清蒸海鲜 | 清蒸鱼银灰鱼皮与白色鱼肉局部特写 | 搜狐清蒸鱼文章第3张图片（文章 613719948） | `foods/neutral-light-staple.webp` |
| 浅色肉类菜式 | 白切鸡浅色熟肉局部特写 | Pexels 30120279 | `foods/neutral-light-staple.webp` |
| 翠绿蔬菜菜式 | 炒青菜翠绿叶片局部特写 | Pexels 36108993 | `foods/deep-green-leaves.webp` |
| 浅色豆腐菌菇菜 | 豆腐菌菇浅色表面局部特写 | Pexels 5182122 | `foods/neutral-light-staple.webp` |
| 深色菌菇酱汁菜 | 熟黑椒牛肉酱汁局部特写 | Wok and Kin 黑椒牛肉 | `foods/dark-brown-roasted.webp` |
| 多色综合摆盘 | 多色水果拼盘局部特写 | Pexels 34664681 | `foods/vivid-red-produce.webp` |
| 汤锅与浓汤菜式 | 沸腾红油火锅局部特写 | 炉鼎技大阪心斋桥店 | `foods/red-brown-cooked-meat.webp` |

各图片的原始页面信息以 `dining-light-data.js` 中记录的 `sourcePage` 为准。使用或再发布图片时应核对对应来源页的署名和许可要求。

## 显示规则

- 缩略图、优化前预览和优化后预览使用同一张局部特写。
- 远程图片已经裁掉完整餐盘和大部分背景，重点保留菜式表面颜色、纹理、油脂和烹饪状态。
- 远程图片加载失败时自动切换本地备用图，页面不显示空白卡片。
- 优化前预览统一使用72%饱和度；只有配方实际应用后，优化后预览才恢复原始饱和度并叠加计算得到的 Lab 差异。
- 预览处理只发生在浏览器画布中，不修改原始图片文件。
