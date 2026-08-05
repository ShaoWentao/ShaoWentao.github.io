# 餐饮菜式视觉分类 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将餐饮光色模块从7种食材样本升级为12类完整菜式，并用17个菜系/餐饮类型标签参与优化权重计算。

**Architecture:** `dining-light-data.js`负责菜式、场景、菜系及合成权重；`dining-panel.js`负责菜系选择、参与状态、上传模板和请求参数；`app.js`只负责缓存键、统一基线和结果上下文。图片资源在完整菜式照片准备齐全后统一替换，当前阶段不重复使用同一图片伪装成不同类型。

**Tech Stack:** Vanilla JavaScript、HTML、CSS、Node.js assert、Puppeteer。

## Global Constraints

- 12个菜式视觉类型均使用81点工程反射率模型。
- 17个菜系/餐饮类型至少包含一个浅色控制类型。
- 场景CCT只使用2700 K、3000 K、3500 K、4000 K。
- 切换场景、菜系、色点模式和增强程度继续使用统一原始通道基线。
- 原图不被修改，右图继续按计算得到的Lab差异生成预览。
- 不提交、不推送，完成验证后由用户决定同步。

---

### Task 1: 12类菜式与17个菜系数据模型

**Files:**
- Modify: `dining-light-data.js`
- Modify: `dining-light-data.test.js`
- Modify: `appearance-assets.test.js`

**Interfaces:**
- Produces: `listMaterials()`, `listProfiles()`, `listCuisineProfiles()`, `getCuisineProfile(id)`, `resolveMaterialIds(sceneId, cuisineId)`, `profileOverrides(sceneId, cuisineId, level)`, `migrateTemplateId(id)`。

- [ ] 更新测试，要求12个菜式ID、17个菜系、浅色控制覆盖和旧ID迁移。
- [ ] 运行 `node dining-light-data.test.js`，确认旧实现失败。
- [ ] 重写餐饮数据模型并保留旧调用签名兼容。
- [ ] 运行数据测试与材质偏好测试。

### Task 2: 菜系选择与12张菜式卡片

**Files:**
- Modify: `index.html`
- Modify: `dining-panel.js`
- Modify: `material-panel.css`
- Modify: `dining-workbench.test.js`

**Interfaces:**
- Consumes: `resolveMaterialIds()`和`profileOverrides()`。
- Produces: 请求字段`cuisineProfileId`、`cuisineProfileName`，卡片状态`is-inactive`和`data-participating`。

- [ ] 更新浏览器测试，要求菜系控件、12张卡片、4/3/2列布局和参与状态。
- [ ] 运行 `node dining-workbench.test.js`，确认旧界面失败。
- [ ] 增加菜系控件、参与状态、菜式文案、上传模板迁移和结果摘要。
- [ ] 运行工作台测试。

### Task 3: 优化缓存和结果上下文

**Files:**
- Modify: `app.js`
- Modify: `dining-condition-switch.test.js`

**Interfaces:**
- Consumes: 请求中的`cuisineProfileId`与`cuisineProfileName`。
- Produces: 结果中的同名字段；缓存键加入菜系ID。

- [ ] 扩展切换测试，覆盖菜系切换与返回同一组合的确定性。
- [ ] 运行测试确认旧实现失败。
- [ ] 修改缓存键和结果上下文。
- [ ] 运行场景及切换回归。

### Task 4: 图片状态与资源说明

**Files:**
- Modify: `assets/appearance/SOURCES.md`
- Modify: `appearance-assets.test.js`

**Interfaces:**
- 菜式数据允许`photo-reference`或`placeholder`；已有合格图片继续本地使用，缺图类型明确显示待补齐，禁止重复图片。

- [ ] 更新资源测试，要求所有已配置图片本地存在且无重复。
- [ ] 更新资源说明，列出12个目标文件与当前缺口。
- [ ] 运行资源测试。

### Task 5: 缓存版本与完整验证

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `metamer-worker.js`
- Modify: `scene-optimizer-worker.js`
- Modify: `package.json`

- [ ] 将缓存版本统一更新为`20260804-dining-dish-taxonomy`。
- [ ] 将新增切换测试加入`test:dining`。
- [ ] 运行餐饮专项测试。
- [ ] 运行`npm test`。
- [ ] 运行`git diff --check -- .`并检查项目状态。
