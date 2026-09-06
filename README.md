# GEO 自动化工作台

把中文 GEO 内容运营流程做成一个可视化、本地运行的项目：客户档案、资料诊断、关键词计划、写作 Prompt、平台合规检查和发布后监测可以在同一个页面里完成。

项目同时保留 5 个可独立安装的 Codex Skill、Python 脚本、Excel 模板和实操文档。所有核心脚本只依赖 Python 标准库。

## 快速开始

需要 Python 3.9 或更高版本。

```bash
git clone https://github.com/haimingdu20-zachary/geo-automation-workbench.git
cd geo-automation-workbench
python3 app/server.py --open
```

如果浏览器没有自动打开，访问 `http://127.0.0.1:8765`。

也可以使用：

```bash
make dev
```

## 工作台包含什么

| 步骤 | 页面动作 | 底层能力 |
| --- | --- | --- |
| 1. 客户档案 | 填资料、导入或导出 JSON、运行诊断 | 资料完备度、优势、缺口和下一步 |
| 2. 关键词计划 | 生成强/中商业词、选题和验收词 | 本地服务、全国品牌、B2B 等规则 |
| 3. 写作 Prompt | 选择关键词、文章类型和平台 | 自动带入客户事实、结构要求与发布红线 |
| 4. 合规检查 | 粘贴标题和正文 | 检查敏感表达、电话、平台禁词和关键词频次 |
| 5. 监测计划 | 生成回查节奏和预警规则 | 固定查询词、引用来源和下一步动作字段 |

## 安装 Codex Skill

查看本项目包含的 Skill：

```bash
python3 scripts/install_skills.py --list
```

首次安装全部 Skill：

```bash
python3 scripts/install_skills.py
```

如果同名 Skill 已存在，脚本默认跳过；加 `--force` 时会先把旧版本备份，再安装新版本。

包含：

- `doubao-geo-publisher`：串起客户诊断、关键词、写稿、平台改写与监测。
- `geo-keyword-miner`：把客户档案生成 GEO 关键词表。
- `geo-article-writer`：生成文章 Brief 和可发布主稿。
- `geo-platform-adapter`：生成头条、搜狐、知乎、36氪等平台版本。
- `geo-doubao-research`：发布前后豆包诊断、对比和竞品信源分析。

## 目录结构

```text
.
├── app/            # 本地 Web 工作台
├── skills/         # 5 个 Codex Skill 与脚本
├── templates/      # Excel、JSON、Markdown 模板
├── docs/           # 自动化说明、实操手册、资料索引
├── scripts/        # 安装辅助脚本
└── tests/          # 核心工作流集成测试
```

## 隐私边界

- 服务默认只监听 `127.0.0.1`，不会向局域网或公网开放。
- 页面调用的是仓库内固定脚本，不接受任意命令或文件路径。
- 浏览器里的草稿只保存在本机浏览器存储中。
- 根目录的 `inputs/`、`outputs/`、`monitoring/`、`workspace/` 和 `workspaces/` 默认被 Git 忽略，避免误传真实客户资料。
- 发布内容前仍需人工核验事实、来源、行业合规和平台规则；最终发布、登录与验证码不做自动化。

## 测试

```bash
make test
```

测试会真实调用诊断、词包、Prompt、合规和监测脚本，确保页面背后的核心链路可执行。

## 更多文档

- [自动化说明](docs/GEO实操手册自动化说明.md)
- [完整实操手册](docs/GEO自动化Skill_实操手册.md)
- [资料文件索引](docs/资料文件索引.md)

## 当前边界

第一版以豆包为主要检验场景，浏览器研究保留人工确认。竞品文章只用于结构和信源分析，不复制其表达；任何没有来源的数据都应删除或改成待补充。
