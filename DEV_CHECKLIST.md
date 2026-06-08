# 开发检查清单

本项目使用 TypeScript + React + Vite + Vitest 技术栈，以下是开发过程中需要执行的质量检查和回归验证流程。

## 快速参考

| 场景 | 命令 | 说明 |
|------|------|------|
| 日常开发快速检查 | `npm run verify:quick` | 类型检查 + 单元测试 |
| 提交代码前 | `npm run precommit` | 类型检查 + ESLint + 单元测试 |
| 修改核心功能后 | `npm run verify` | 完整验证：类型 + ESLint + 测试 + 构建 |
| CI 流水线 | `npm run verify:ci` | 完整验证 + 覆盖率报告 |
| 仅运行特定模块测试 | 见下方「模块专项测试」 | 针对修改模块运行对应测试 |

## 完整验证流程

### 1. TypeScript 类型检查

```bash
npm run typecheck
```

- 执行完整的 TypeScript 类型检查，不生成输出文件
- 检查所有 `.ts` 和 `.tsx` 文件的类型正确性
- 确保没有 `any` 类型滥用和类型错误

**常见问题处理：**
- 出现类型错误时，优先修复类型，而非使用 `@ts-ignore` 或 `as any`
- 第三方库类型缺失时，可在 `src/types` 目录下补充声明文件

### 2. ESLint 代码检查

```bash
npm run lint
```

- 检查代码风格和潜在问题
- 遵循推荐的 React 和 TypeScript 最佳实践

**自动修复：**
```bash
npm run lint:fix
```

**检查规则：**
- 禁止未使用的变量和导入
- React Hooks 依赖项检查
- 组件导出规范检查
- 类型安全检查

### 3. 单元测试

```bash
# 运行所有测试
npm run test

# 监听模式（开发时使用）
npm run test:watch

# 带覆盖率报告
npm run test:coverage

# 可视化测试界面
npm run test:ui
```

**覆盖率要求：**
- 行覆盖率 ≥ 70%
- 函数覆盖率 ≥ 70%
- 分支覆盖率 ≥ 70%
- 语句覆盖率 ≥ 70%

覆盖率报告生成在 `coverage/` 目录下，可通过浏览器打开 `coverage/index.html` 查看详细报告。

### 4. 构建验证

```bash
npm run build
```

- 执行 TypeScript 编译 + Vite 生产构建
- 确保代码可以正常编译打包
- 构建产物输出到 `dist/` 目录

**构建预览：**
```bash
npm run preview
```

## 模块专项测试

当你修改特定功能模块时，请运行对应的专项测试：

### CSV 导入功能

```bash
npm run test:csv
```

**相关文件：**
- 实现：[src/utils/csv.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/csv.ts)
- 测试：[src/utils/helpers.test.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/helpers.test.ts)

**覆盖场景：**
- CSV 解析（含 BOM、CRLF、引号字段、换行等）
- 字段自动映射（中英文表头、别名识别）
- 数据验证（必填项、日期格式、布尔值、合规状态）
- 重复标本编号检测
- 展盒/批次自动创建识别
- 数据转换为表单格式

### 备份与恢复功能

```bash
npm run test:backup
```

**相关文件：**
- 实现：[src/utils/backup.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/backup.ts)
- 测试：[src/utils/backup.test.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/backup.test.ts)

**覆盖场景：**
- 备份数据结构创建
- 备份文件解析和格式验证
- 版本兼容性检查
- 数据迁移（合规字段补全）
- 冲突分析（ID 冲突、编号重复、引用丢失）
- ID 重映射计划生成
- 重复编号自动处理
- 覆盖/合并恢复执行
- 引用完整性过滤

### 备份差异合并功能

```bash
npm run test:diffmerge
```

**相关文件：**
- 实现：[src/utils/diffMerge.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/diffMerge.ts)
- 测试：[src/utils/diffMerge.test.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/diffMerge.test.ts)

**覆盖场景：**
- 差异分析（新增、删除、字段不一致）
- 标本编号冲突检测
- 引用丢失检测（展盒/批次）
- 默认合并策略设置
- 合并执行（新增、更新、删除）
- 快照创建和恢复
- ID 重映射和引用修复
- 辅助函数（标签、颜色）

### 标签打印功能

```bash
npm run test:label
```

**相关文件：**
- 实现：[src/utils/labelPrint.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/labelPrint.ts)
- 测试：[src/utils/labelPrint.test.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/labelPrint.test.ts)

**覆盖场景：**
- 标签数据提取（标本信息 + 展盒信息）
- 必填字段检查（标本编号、物种、采集地、日期、展盒位置）
- 批量字段检查
- 打印样式生成
- 分页逻辑

### 通用工具函数

```bash
npm run test:common
```

**相关文件：**
- 实现：[src/utils/common.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/common.ts)
- 测试：[src/utils/common.test.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/utils/common.test.ts)

**覆盖场景：**
- ID 生成（时间戳 + 随机字符串）
- 日期格式化
- 今日日期获取
- CSV 字段转义
- 文件下载（CSV、JSON）
- 文件读取

### 拍摄会话功能

拍摄会话的核心逻辑在 Hook 中实现，相关测试可以通过单元测试覆盖工具函数，通过 E2E 测试覆盖完整流程。

**相关文件：**
- Hook 实现：[src/hooks/usePhotographySessions.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/src/hooks/usePhotographySessions.ts)

**修改时建议检查：**
1. 运行 `npm run test:common` 确保底层工具函数正常
2. 运行 `npm run verify` 确保类型和构建正确
3. 手动验证：创建会话、添加目标、更新进度、导出清单

## 工作流建议

### 开发新功能

1. 创建 feature 分支
2. 编写代码和对应的单元测试
3. 运行 `npm run verify:quick` 快速检查
4. 提交前运行 `npm run precommit`

### 修改核心功能

修改以下核心功能时，请务必运行完整验证流程：
- CSV 导入导出逻辑
- 备份/恢复/差异合并算法
- 标签打印布局和样式
- 拍摄会话进度计算

```bash
npm run verify
```

### 提交 Pull Request

PR 合并前必须通过：
1. `npm run typecheck` - 类型检查通过
2. `npm run lint` - 无 lint 错误
3. `npm run test` - 所有测试通过
4. `npm run build` - 构建成功

## 配置文件说明

| 文件 | 说明 |
|------|------|
| [tsconfig.json](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/tsconfig.json) | TypeScript 编译配置 |
| [eslint.config.js](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/eslint.config.js) | ESLint 规则配置 |
| [vitest.config.ts](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/vitest.config.ts) | Vitest 测试配置（含覆盖率） |
| [package.json](file:///Users/zhuanzmima0000/Desktop/label%20project/Solo%20coder%200601/xzwl-6/package.json) | 项目依赖和脚本命令 |

## 故障排查

### 类型检查失败

1. 检查是否遗漏了必要的类型导入
2. 确认第三方库的类型定义是否正确安装
3. 复杂类型问题可使用 `// @ts-expect-error` 并添加注释说明

### 测试失败

1. 检查测试数据是否符合最新的类型定义
2. 确认 mock 数据是否覆盖了所有分支
3. 异步测试注意使用 `async/await` 或 `done()` 回调

### 构建失败

1. 清理构建缓存：`rm -rf node_modules/.tmp dist`
2. 重新安装依赖：`npm install`
3. 检查 Vite 配置是否正确

## 未来 CI 接入

所有命令都设计为可在 CI 环境中直接运行：

```yaml
# 示例 GitHub Actions 步骤（无需额外配置）
- run: npm ci
- run: npm run typecheck
- run: npm run lint
- run: npm run test:coverage
- run: npm run build
```

无需复杂的 CI 平台配置，直接复用现有脚本即可。
