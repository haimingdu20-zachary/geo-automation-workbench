"use strict";

const STORAGE_KEY = "geo-workbench-profile-v1";
const sectionNames = {
  profile: "客户档案",
  plan: "关键词计划",
  prompt: "写作 Prompt",
  guard: "合规检查",
  monitoring: "监测计划",
};

const blankProfile = () => ({
  client_stage: "cold_start",
  objectives: [],
  conversion_goal: "",
  target_customers: [],
  brand_name: "",
  brand_short: "",
  industry: "",
  business_type: "local_b2c",
  service_area: [],
  primary_city: "",
  core_services: [],
  core_products: [],
  customer_language: [],
  pain_points: [],
  brand_terms: [],
  competitors: [],
  channels: [],
  content_assets: [],
  eeat: { expertise: [], experience: [], authority: [], trust: [] },
  verified_sources: [],
  media_coverage: [],
  contact: { phone: "", website: "", address: "" },
  monitoring_baseline: { tracked_queries: [], current_visibility: "" },
  compliance: { industry_sensitivity: "general", notes: [] },
});

const state = {
  profile: blankProfile(),
  plan: null,
  diagnosis: null,
  monitoring: null,
};

const byId = (id) => document.getElementById(id);
const toLines = (value) => (Array.isArray(value) ? value.filter(Boolean).join("\n") : "");
const fromLines = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let toastTimer;
function toast(message, type = "info") {
  const node = byId("toast");
  node.textContent = message;
  node.className = `toast show${type === "error" ? " error" : ""}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.className = "toast";
  }, 2800);
}

function setLoading(button, loading, label) {
  if (!button) return;
  if (loading) {
    button.dataset.original = button.querySelector("span")?.textContent || button.textContent;
    button.classList.add("loading");
    button.disabled = true;
    const span = button.querySelector("span");
    if (span) span.textContent = label || "处理中…";
  } else {
    button.classList.remove("loading");
    button.disabled = false;
    const span = button.querySelector("span");
    if (span && button.dataset.original) span.textContent = button.dataset.original;
  }
}

async function api(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error("无法连接本地服务，请确认工作台仍在运行。");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    throw new Error(body.error || "处理失败，请检查输入后重试。");
  }
  return body.data;
}

function normalizeProfile(raw) {
  const base = blankProfile();
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    ...base,
    ...input,
    eeat: { ...base.eeat, ...(input.eeat || {}) },
    contact: { ...base.contact, ...(input.contact || {}) },
    monitoring_baseline: { ...base.monitoring_baseline, ...(input.monitoring_baseline || {}) },
    compliance: { ...base.compliance, ...(input.compliance || {}) },
  };
}

function evidenceToText(eeat) {
  const labels = {
    expertise: "专业",
    experience: "经验",
    authority: "权威",
    trust: "可信",
  };
  return Object.entries(labels)
    .flatMap(([key, label]) => (eeat?.[key] || []).map((item) => `[${label}] ${item}`))
    .join("\n");
}

function textToEvidence(text) {
  const result = { expertise: [], experience: [], authority: [], trust: [] };
  const tags = { 专业: "expertise", 经验: "experience", 权威: "authority", 可信: "trust" };
  fromLines(text).forEach((line) => {
    const match = line.match(/^\[?(专业|经验|权威|可信)\]?\s*[:：]?\s*(.+)$/);
    if (match) result[tags[match[1]]].push(match[2]);
    else result.trust.push(line);
  });
  return result;
}

function fillForm(profile) {
  byId("brandName").value = profile.brand_name || "";
  byId("brandShort").value = profile.brand_short || "";
  byId("industry").value = profile.industry || "";
  byId("businessType").value = profile.business_type || "local_b2c";
  byId("primaryCity").value = profile.primary_city || "";
  byId("conversionGoal").value = profile.conversion_goal || "";
  byId("serviceArea").value = toLines(profile.service_area);
  byId("coreServices").value = toLines(profile.core_services);
  byId("targetCustomers").value = toLines(profile.target_customers);
  byId("customerLanguage").value = toLines(profile.customer_language);
  byId("evidence").value = evidenceToText(profile.eeat);
  syncJsonEditor();
  updateCompletion();
}

function updateProfileFromForm({ persist = true } = {}) {
  state.profile = normalizeProfile({
    ...state.profile,
    brand_name: byId("brandName").value.trim(),
    brand_short: byId("brandShort").value.trim(),
    industry: byId("industry").value.trim(),
    business_type: byId("businessType").value,
    primary_city: byId("primaryCity").value.trim(),
    conversion_goal: byId("conversionGoal").value.trim(),
    service_area: fromLines(byId("serviceArea").value),
    core_services: fromLines(byId("coreServices").value),
    target_customers: fromLines(byId("targetCustomers").value),
    customer_language: fromLines(byId("customerLanguage").value),
    eeat: textToEvidence(byId("evidence").value),
  });
  if (persist) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
  }
  syncJsonEditor();
  updateCompletion();
  return state.profile;
}

function syncJsonEditor() {
  byId("profileJson").value = JSON.stringify(state.profile, null, 2);
}

function updateCompletion() {
  const checks = [
    byId("brandName").value.trim(),
    byId("industry").value.trim(),
    byId("primaryCity").value.trim(),
    fromLines(byId("serviceArea").value).length,
    fromLines(byId("coreServices").value).length,
    fromLines(byId("targetCustomers").value).length,
    fromLines(byId("customerLanguage").value).length,
    fromLines(byId("evidence").value).length >= 3,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  byId("profileCompletion").textContent = score;
}

function navigate(step) {
  if (!sectionNames[step]) return;
  document.querySelectorAll(".pipeline-step").forEach((button) => {
    const active = button.dataset.step === step;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll(".step-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === step);
  });
  byId("currentSection").textContent = sectionNames[step];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderList(node, items, emptyText) {
  clear(node);
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    node.appendChild(create("li", "empty-line", emptyText));
    return;
  }
  safeItems.forEach((item) => node.appendChild(create("li", "", item)));
}

function renderDiagnosis(report) {
  const score = Number(report.readiness_score || 0);
  const levelNames = {
    ready: "可进入生产",
    nearly_ready: "接近可用",
    foundation_missing: "基础资料待补",
  };
  state.diagnosis = report;
  byId("diagnosisScore").textContent = score;
  byId("scoreOrbit").style.setProperty("--score", Math.max(0, Math.min(100, score)));
  byId("diagnosisLevel").textContent = levelNames[report.readiness_level] || report.readiness_level || "已完成";
  byId("diagnosisTitle").textContent = report.brand_name ? `${report.brand_name} · ${report.service_mode || ""}` : "客户资料诊断完成";
  byId("diagnosisSummary").textContent =
    score >= 80
      ? "资料已具备进入关键词与内容规划的基础，仍请在发布前核验每条事实。"
      : "建议先补齐右侧列出的缺口，再进入批量生产，避免内容空泛或事实失真。";
  renderList(byId("strengthList"), report.strengths, "暂未识别出明显优势");
  renderList(byId("gapList"), report.gaps, "暂无明显缺口");
  byId("goPlan").disabled = false;
}

function keywordItems(bucket) {
  return Array.isArray(bucket)
    ? bucket.map((item) => (typeof item === "string" ? { keyword: item } : item)).filter((item) => item.keyword)
    : [];
}

function allKeywords() {
  const buckets = state.plan?.keyword_buckets || {};
  return [...keywordItems(buckets.strong_commercial), ...keywordItems(buckets.medium_commercial)].map(
    (item) => item.keyword,
  );
}

function renderPlan(plan) {
  state.plan = plan;
  const strong = keywordItems(plan.keyword_buckets?.strong_commercial);
  const medium = keywordItems(plan.keyword_buckets?.medium_commercial);
  const angles = Array.isArray(plan.article_angles) ? plan.article_angles : [];
  const queries = Array.isArray(plan.validation_queries) ? plan.validation_queries : [];

  byId("strongCount").textContent = strong.length;
  byId("mediumCount").textContent = medium.length;
  byId("angleCount").textContent = angles.length;
  byId("queryCount").textContent = queries.length;

  const groups = byId("keywordGroups");
  clear(groups);
  groups.className = "keyword-groups";
  const definitions = [
    ["强商业词", strong],
    ["中商业词", medium],
  ];
  definitions.forEach(([label, items]) => {
    const group = create("section", "keyword-group");
    const heading = create("h3");
    heading.append(create("span", "", label), create("small", "", `${items.length} 个候选`));
    const cloud = create("div", "keyword-cloud");
    if (!items.length) cloud.appendChild(create("span", "empty-line", "本次没有生成该类型关键词"));
    items.forEach((item) => {
      const button = create("button", "keyword-chip", item.keyword);
      button.type = "button";
      button.title = item.reason || "送入写作步骤";
      button.addEventListener("click", () => selectKeyword(item.keyword));
      cloud.appendChild(button);
    });
    group.append(heading, cloud);
    groups.appendChild(group);
  });

  const angleList = byId("angleList");
  clear(angleList);
  angleList.className = "angle-list";
  if (!angles.length) {
    angleList.className += " empty-state compact-empty";
    angleList.appendChild(create("p", "", "本次没有生成推荐选题。"));
  } else {
    angles.forEach((angle) => {
      const item = create("article", "angle-item");
      item.append(
        create("h3", "", angle.toutiao_title || angle.primary_keyword || angle.article_type_label || "推荐选题"),
        create("p", "", (angle.outline_focus || []).join(" · ") || "可根据实际证据继续完善结构。"),
      );
      item.addEventListener("click", () => angle.primary_keyword && selectKeyword(angle.primary_keyword));
      angleList.appendChild(item);
    });
  }

  const suggestions = byId("keywordSuggestions");
  clear(suggestions);
  [...new Set([...allKeywords(), ...queries])].forEach((keyword) => {
    const option = create("option");
    option.value = keyword;
    suggestions.appendChild(option);
  });
}

function selectKeyword(keyword) {
  byId("promptKeyword").value = keyword;
  byId("guardKeyword").value = keyword;
  navigate("prompt");
  toast(`已选择关键词：${keyword}`);
}

function renderGuard(report) {
  const wrapper = byId("guardResult");
  const status = wrapper.querySelector(".guard-status strong");
  const summary = wrapper.querySelector("p");
  wrapper.className = `guard-result ${report.passed ? "passed" : "failed"}`;
  status.textContent = report.passed ? "未发现阻断性问题" : "发现发布前必须处理的问题";
  summary.textContent = `建议标题：${report.suggested_title || "保持原题"}`;
  const list = byId("issueList");
  clear(list);
  const issues = Array.isArray(report.issues) ? report.issues : [];
  if (!issues.length) list.appendChild(create("li", "", "未发现规则命中项。"));
  issues.forEach((issue) => {
    list.appendChild(create("li", issue.severity || "warning", `[${issue.severity === "error" ? "错误" : "提醒"}] ${issue.message}`));
  });
}

function renderMonitoring(plan) {
  state.monitoring = plan;
  const cadence = plan.cadence && typeof plan.cadence === "object" ? Object.values(plan.cadence) : [];
  const timeline = byId("cadenceTimeline");
  clear(timeline);
  timeline.className = "timeline";
  cadence.forEach((label, index) => {
    const item = create("div", "timeline-item");
    const dot = create("i", "", index + 1);
    const copy = create("div");
    copy.append(create("strong", "", label), create("small", "", index === cadence.length - 1 ? "进入常规复盘" : "记录同一组字段"));
    item.append(dot, copy);
    timeline.appendChild(item);
  });
  if (!cadence.length) {
    timeline.className += " empty-state compact-empty";
    timeline.appendChild(create("p", "", "暂无回查节奏。"));
  }

  const queries = Array.isArray(plan.queries) ? plan.queries : [];
  byId("monitorQueryCount").textContent = `${queries.length} 个`;
  const queryNode = byId("monitorQueries");
  clear(queryNode);
  queryNode.className = "monitor-queries";
  queries.forEach((item) => {
    const row = create("div", "monitor-query");
    row.append(create("strong", "", item.query || item), create("span", "", `${(item.checkpoints || []).length} 个记录项`));
    queryNode.appendChild(row);
  });
  if (!queries.length) {
    queryNode.className += " empty-state compact-empty";
    queryNode.appendChild(create("p", "", "暂无监测查询。"));
  }
  renderList(byId("alertRules"), plan.alert_rules, "暂无预警规则");
}

function loadStoredProfile() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    state.profile = stored ? normalizeProfile(JSON.parse(stored)) : blankProfile();
  } catch (error) {
    state.profile = blankProfile();
  }
  fillForm(state.profile);
}

async function loadSample() {
  try {
    const response = await fetch("/api/template");
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "示例加载失败");
    state.profile = normalizeProfile(payload.data);
    fillForm(state.profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
    toast("已加载脱敏示例，可直接体验完整流程。");
  } catch (error) {
    toast(error.message, "error");
  }
}

function exportProfile() {
  updateProfileFromForm();
  const blob = new Blob([`${JSON.stringify(state.profile, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = create("a");
  const safeBrand = (state.profile.brand_short || state.profile.brand_name || "client-profile").replace(/[\\/:*?"<>|\s]+/g, "-");
  link.href = url;
  link.download = `${safeBrand}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("客户档案已导出。自有客户文件请不要提交到公开仓库。");
}

function bindEvents() {
  byId("pipeline").addEventListener("click", (event) => {
    const button = event.target.closest("[data-step]");
    if (button) navigate(button.dataset.step);
  });

  byId("profileForm").addEventListener("input", (event) => {
    if (event.target.id !== "profileJson") updateProfileFromForm();
  });

  byId("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = byId("runDiagnosis");
    try {
      setLoading(button, true, "诊断中…");
      const report = await api("/api/diagnose", { profile: updateProfileFromForm() });
      renderDiagnosis(report);
      toast("客户诊断已完成。");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  byId("runPlan").addEventListener("click", async () => {
    const button = byId("runPlan");
    try {
      setLoading(button, true, "生成中…");
      const plan = await api("/api/plan", { profile: updateProfileFromForm() });
      renderPlan(plan);
      toast("关键词与选题计划已生成。");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  byId("promptForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    try {
      setLoading(button, true, "组装中…");
      const result = await api("/api/prompt", {
        profile: updateProfileFromForm(),
        keyword: byId("promptKeyword").value.trim(),
        article_type: byId("articleType").value,
        platform: byId("promptPlatform").value,
      });
      byId("promptOutput").value = result.prompt || "";
      byId("copyPrompt").disabled = !result.prompt;
      byId("guardKeyword").value = byId("promptKeyword").value.trim();
      toast("写作 Prompt 已生成。");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  byId("copyPrompt").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byId("promptOutput").value);
      toast("Prompt 已复制到剪贴板。");
    } catch (error) {
      byId("promptOutput").select();
      toast("已选中全文，请使用系统复制快捷键。");
    }
  });

  byId("guardForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    try {
      setLoading(button, true, "检查中…");
      const report = await api("/api/guard", {
        title: byId("articleTitle").value.trim(),
        article: byId("articleBody").value,
        keyword: byId("guardKeyword").value.trim(),
        platform: byId("guardPlatform").value,
        industry: byId("guardIndustry").value,
      });
      renderGuard(report);
      toast(report.passed ? "检查完成，未发现阻断性问题。" : "检查完成，请先处理错误项。", report.passed ? "info" : "error");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  byId("runMonitoring").addEventListener("click", async () => {
    const button = byId("runMonitoring");
    try {
      setLoading(button, true, "生成中…");
      const result = await api("/api/monitoring", {
        profile: updateProfileFromForm(),
        plan: state.plan,
      });
      renderMonitoring(result);
      toast("监测计划已生成。");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setLoading(button, false);
    }
  });

  byId("articleBody").addEventListener("input", () => {
    const count = byId("articleBody").value.replace(/\s+/g, "").length;
    byId("articleCount").textContent = `${count} 字`;
  });

  byId("goPlan").addEventListener("click", () => navigate("plan"));
  byId("loadSample").addEventListener("click", loadSample);
  byId("exportProfile").addEventListener("click", exportProfile);
  byId("importProfile").addEventListener("click", () => byId("profileFile").click());

  byId("profileFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("文件超过 2 MB，请检查是否选择了正确的 JSON。 ");
      state.profile = normalizeProfile(JSON.parse(await file.text()));
      fillForm(state.profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
      toast("客户档案已导入。\n");
    } catch (error) {
      toast(error.message || "JSON 文件无法解析。", "error");
    } finally {
      event.target.value = "";
    }
  });

  byId("applyJson").addEventListener("click", () => {
    try {
      state.profile = normalizeProfile(JSON.parse(byId("profileJson").value));
      fillForm(state.profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
      toast("完整 JSON 已应用到表单。");
    } catch (error) {
      toast("JSON 格式有误，请检查逗号、引号和括号。", "error");
    }
  });
}

async function checkServer() {
  const status = byId("serverStatus");
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error();
    status.innerHTML = "<i></i> 本地服务已连接";
    status.classList.remove("offline");
  } catch (error) {
    status.innerHTML = "<i></i> 本地服务未连接";
    status.classList.add("offline");
  }
}

function init() {
  loadStoredProfile();
  bindEvents();
  checkServer();
}

document.addEventListener("DOMContentLoaded", init);
