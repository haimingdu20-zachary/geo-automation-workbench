# GEO 自动化 Skill 实操手册

> 这份手册是带大家现场"跟着敲命令、看输出"用的，不是讲原理的文档。
> 语气提前定好：**我也是第一次带大家把这套流程完整跑一遍，我们一起当第一批用户，边跑边看哪里会卡。**
> 全程用同一个示例案例贯穿——"北京一家宠物美容店"，方便对照每一步的输出。

---

## 会前准备（请提前发给学员，不占用现场时间）

现场只跑命令、看输出，装环境的事提前做完，不然大家会卡在"装东西"上，跟内容没关系还耽误时间。

**第一步，确认电脑装了 Python 3。**

打开终端（Mac：启动台搜索"终端"；Windows：搜索"PowerShell"），输入：

```bash
python3 --version
```

看到类似 `Python 3.9.6` 这样的版本号就说明装好了。如果提示"找不到命令"，去 [python.org](https://www.python.org/downloads/) 下载安装一下（装的时候记得勾选"Add to PATH"）。

**第二步，把这个 Skill 整合包放到自己电脑上**，随便放哪个文件夹都行，记住路径。

**第三步，打开终端，`cd` 到这个文件夹里**，比如：

```bash
cd 桌面/GEO自动化Skill整合包
```

**这套脚本不需要额外装任何库**，全部用 Python 自带的功能写的，没有 `pip install` 这一步，环境准备到这里就结束了。

---

## Step ① 客户诊断——先看看资料够不够

### 先填一份客户档案

我们先一起复制一份客户档案模板，填成"北京宠物美容店"这个示例：

```bash
cp skills/doubao-geo-publisher/assets/client_profile.template.json my_client.json
```

用任何文本编辑器（记事本、VS Code 都行）打开 `my_client.json`，跟着改这几个关键字段（其他字段可以先留着模板默认值，或者填"待补充"）：

| 字段 | 填什么 | 示例 |
|---|---|---|
| `brand_name` | 品牌全称 | "示例宠物美容品牌全称" |
| `industry` | 行业 | "宠物服务" |
| `service_area` | 服务区域 | ["北京朝阳区", "北京"] |
| `core_services` | 核心服务 | ["宠物洗澡", "宠物造型", "宠物SPA"] |
| `customer_language` | 用户会怎么问 | ["北京宠物美容店推荐", "朝阳区宠物美容哪家靠谱"] |
| `eeat` | 专业度/经验/权威/可信度证据 | 参照模板结构填 |

> **划重点：没有的信息就写"待补充"，千万别编。** 这是这套流程唯一的硬规矩——宁可留空，不能瞎写。

### 跑诊断脚本

```bash
python3 skills/doubao-geo-publisher/scripts/diagnose_client.py --input my_client.json --format markdown
```

**大家应该会看到类似这样的输出：**

```
# 客户诊断报告

- 品牌：示例宠物美容品牌全称
- 场景：新客户冷启动
- 服务模式：本地服务型
- 完备度评分：100 (ready)

## 当前优势
- 品牌和行业基础信息清晰，可以进入关键词规划。
- E-E-A-T 证据相对完整，适合直接做内容生产。
...

## 当前缺口
- 暂无明显缺口

## 建议下一步
- 先产出第一批关键词和文章角度，再同步准备平台版本。
...
```

**这一步现场要停下来做的事：** 让每个人对照自己的输出，看"当前缺口"那一栏写了什么——如果不是"暂无明显缺口"，说明刚才填的字段还不够，回去补一下再继续（这是故意设计的检查点，用来卡住"资料不全就往下做"的情况）。

---

## Step ② 关键词挖掘——批量生成商业词

```bash
python3 skills/doubao-geo-publisher/scripts/generate_geo_plan.py --input my_client.json --output geo_plan.json
```

跑完之后，用编辑器打开 `geo_plan.json` 看看，里面有几块内容：

- `keyword_buckets`：按强弱分类的关键词（`strong_commercial` / `medium_commercial`），比如会生成"北京宠物洗澡怎么选""北京宠物洗澡哪家好"这类词
- `article_angles`：推荐的文章角度，每个角度自带标题候选、大纲重点、FAQ种子问题
- `validation_queries`：后面监测要用的验证词

**现场讨论环节：** 让大家看自己生成的 `medium_commercial` 词表，一起判断——这些词里有没有哪个是"太宽泛""竞争太大"应该删掉的？这一步呼应我们前面讲的"选词法则"，脚本生成的是候选池，**真正决定留哪几个，还是要靠人判断**。

---

## Step ③ 写稿——生成 Prompt，再交给 AI 写正文

先从 Step② 生成的关键词里选一个，配上文章类型和平台，生成写作 Prompt：

```bash
python3 skills/doubao-geo-publisher/scripts/build_prompt_packet.py \
  --profile my_client.json \
  --keyword "北京宠物洗澡怎么选" \
  --article-type guide \
  --platform toutiao \
  --output prompt_packet.md
```

`--article-type` 可以选：`guide`（选购指南）、`analysis`（行业分析）、`annual`（年度盘点）、`procurement`（采购决策），对应我们前面讲过的几种内容形态。

打开 `prompt_packet.md`，会看到一份完整的写作指令，里面已经自动带上了：品牌信息、E-E-A-T证据、文章结构要求，还有一堆**硬约束**，比如：

```
- 不要出现 EEAT、GEO、SEO、豆包优化、关键词布局 等行话。
- 不要出现 客户资料显示、补充材料显示、实体链 等内部交付痕迹。
- 目标客户 / 品牌 / 人物只能在正文中后段自然出现...
```

**这几条硬约束就是我们前面讲的"合规红线+写作细则"落地成了机器可执行的规则。**

**现场操作：** 把 `prompt_packet.md` 里的全部内容复制出来，粘贴到你平时用的AI对话框里（豆包、DeepSeek、Claude都行），回车，看着正文被生成出来。这一步能直观感受到——前面几步做的所有结构化工作，最后都是为了拼出这一份"喂给AI"的完整指令。

把生成的正文保存成一个文件，比如 `article.md`，下一步要用。

---

## Step ④ 平台改写 + 合规检查——揪出发布前的问题

拿到正文之后，跑一下合规检查，看看它能不能挑出问题：

```bash
python3 skills/doubao-geo-publisher/scripts/platform_guard.py \
  --platform sohu \
  --industry general \
  --keyword "北京宠物洗澡怎么选" \
  --title "2026北京宠物洗澡怎么选这5点要看清" \
  --article article.md
```

**输出大概长这样：**

```
Platform: sohu
Industry: general
Passed: yes
Suggested title: 2026北京宠物洗澡怎么选这5点要看清
Issues:
- [warning] 正文偏短，可能不利于形成完整结构。
- [warning] 正文中目标关键词仅出现 1 次，可再自然补充。
```

它会检查：标题长度/年份/数字、搜狐号标题禁词、电话号有没有泄漏、医疗类敏感表达、优化术语有没有外露、关键词出现频次这些点——**对应我们前面讲的"合规红线"那一页，这里全部变成了可以自动跑的检查项**。

**现场可以做个小实验：** 故意在文章里加一句"这是绝对最好的选择，百分百有效"，再跑一遍，看看它能不能抓出这种违规表达。这个实验能让大家直观理解"合规检查"到底在查什么。

---

## Step ⑤ 发布前诊断——生成监测计划

正式发布前，先生成一份监测计划，明确"发布之后要盯哪些词、多久查一次"：

```bash
python3 skills/doubao-geo-publisher/scripts/build_monitoring_plan.py \
  --profile my_client.json \
  --plan geo_plan.json \
  --output monitoring_plan.json
```

打开看看，里面会有：

- `cadence`：查询节奏（发布后第1天、第3天、第7天，之后每周一次——跟我们前面讲的"每周固定查一次"完全对应）
- `queries`：具体要查哪些词，每个词要记录哪些字段（是否出现目标品牌、是否出现竞品、引用来源、回答偏知识还是偏推荐）
- `alert_rules`：什么情况要报警，比如"连续两轮都没出现目标品牌，需要复盘关键词和文章结构"

> **这一步现场只能演示到"生成计划"为止**，真正拿这些词去豆包搜、看有没有被引用，需要文章已经发布过一段时间才有意义，没法在现场几分钟内完整跑通，讲清楚"以后你们回去这么用"就行。

---

## 收尾：把大家踩的坑记下来

这是收尾环节，不是脚本步骤。做两件事：

1. **现场问一圈**：跑到哪一步卡住了？报错信息是什么？（大概率会出现的坑：JSON格式改错导致解析失败、文件路径打错、字段名拼错——这些都很正常，第一次跑脚本几乎人人都会遇到）
2. **把卡住的地方记下来**，作为"我们踩过的坑"补充到后续的分享材料里——这跟你在FB投流部分讲"年龄段判断失误""素材疲劳"是同一个逻辑：**真实的坑比讲原理更有说服力**。

---

## 附：完整命令清单（方便直接复制）

```bash
# 环境检查
python3 --version

# Step① 客户诊断
cp skills/doubao-geo-publisher/assets/client_profile.template.json my_client.json
# （手动编辑 my_client.json）
python3 skills/doubao-geo-publisher/scripts/diagnose_client.py --input my_client.json --format markdown

# Step② 关键词挖掘
python3 skills/doubao-geo-publisher/scripts/generate_geo_plan.py --input my_client.json --output geo_plan.json

# Step③ 写稿Prompt
python3 skills/doubao-geo-publisher/scripts/build_prompt_packet.py \
  --profile my_client.json \
  --keyword "北京宠物洗澡怎么选" \
  --article-type guide \
  --platform toutiao \
  --output prompt_packet.md

# Step④ 平台改写 + 合规检查
python3 skills/doubao-geo-publisher/scripts/platform_guard.py \
  --platform sohu \
  --industry general \
  --keyword "北京宠物洗澡怎么选" \
  --title "2026北京宠物洗澡怎么选这5点要看清" \
  --article article.md

# Step⑤ 监测计划
python3 skills/doubao-geo-publisher/scripts/build_monitoring_plan.py \
  --profile my_client.json \
  --plan geo_plan.json \
  --output monitoring_plan.json
```
