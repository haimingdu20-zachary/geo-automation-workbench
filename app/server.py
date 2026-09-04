#!/usr/bin/env python3
"""Serve the GEO automation workbench on localhost.

The server deliberately uses only Python's standard library. Workflow requests are
mapped to a small, fixed set of bundled scripts; callers cannot submit commands or
filesystem paths.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import threading
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple


PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATIC_ROOT = PROJECT_ROOT / "app" / "static"
SKILL_ROOT = PROJECT_ROOT / "skills" / "doubao-geo-publisher"
SCRIPT_ROOT = SKILL_ROOT / "scripts"
PROFILE_TEMPLATE = SKILL_ROOT / "assets" / "client_profile.template.json"
MAX_BODY_BYTES = 2 * 1024 * 1024
SCRIPT_TIMEOUT_SECONDS = 30


class WorkflowError(RuntimeError):
    """A safe, user-facing workflow error."""


def _require_mapping(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise WorkflowError(f"{label} 必须是 JSON 对象。")
    return value


def _require_text(value: Any, label: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise WorkflowError(f"{label} 必须是文本。")
    result = value.strip()
    if not allow_empty and not result:
        raise WorkflowError(f"请填写{label}。")
    return result


class WorkflowRunner:
    """Run the package's supported scripts through typed, fixed interfaces."""

    def __init__(self, python_executable: str = sys.executable) -> None:
        self.python_executable = python_executable

    def template(self) -> Dict[str, Any]:
        return json.loads(PROFILE_TEMPLATE.read_text(encoding="utf-8"))

    def _run(
        self,
        script_name: str,
        arguments: Sequence[str],
        *,
        allowed_codes: Iterable[int] = (0,),
    ) -> str:
        script_path = SCRIPT_ROOT / script_name
        if not script_path.is_file():
            raise WorkflowError(f"缺少工作流脚本：{script_name}")

        try:
            completed = subprocess.run(
                [self.python_executable, str(script_path), *arguments],
                cwd=str(PROJECT_ROOT),
                check=False,
                capture_output=True,
                text=True,
                timeout=SCRIPT_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired as exc:
            raise WorkflowError("处理超时，请缩短输入内容后重试。") from exc

        if completed.returncode not in set(allowed_codes):
            detail = (completed.stderr or completed.stdout or "未知错误").strip()
            raise WorkflowError(f"工作流执行失败：{detail[-1200:]}")
        return completed.stdout.strip()

    @staticmethod
    def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    @staticmethod
    def _parse_json(output: str) -> Dict[str, Any]:
        try:
            parsed = json.loads(output)
        except json.JSONDecodeError as exc:
            raise WorkflowError("脚本返回了无法识别的结果。") from exc
        return _require_mapping(parsed, "工作流结果")

    def diagnose(self, profile: Mapping[str, Any]) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="geo-workbench-") as temp_dir:
            profile_path = Path(temp_dir) / "profile.json"
            self._write_json(profile_path, profile)
            output = self._run(
                "diagnose_client.py",
                ["--input", str(profile_path), "--format", "json"],
            )
        return self._parse_json(output)

    def plan(self, profile: Mapping[str, Any]) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="geo-workbench-") as temp_dir:
            profile_path = Path(temp_dir) / "profile.json"
            self._write_json(profile_path, profile)
            output = self._run("generate_geo_plan.py", ["--input", str(profile_path)])
        return self._parse_json(output)

    def prompt(
        self,
        profile: Mapping[str, Any],
        keyword: str,
        article_type: str,
        platform: str,
    ) -> Dict[str, Any]:
        allowed_types = {"cognitive", "selection", "observation", "outcome", "profile"}
        allowed_platforms = {"toutiao", "sohu", "both"}
        if article_type not in allowed_types:
            raise WorkflowError("文章类型不受支持。")
        if platform not in allowed_platforms:
            raise WorkflowError("目标平台不受支持。")

        with tempfile.TemporaryDirectory(prefix="geo-workbench-") as temp_dir:
            profile_path = Path(temp_dir) / "profile.json"
            self._write_json(profile_path, profile)
            output = self._run(
                "build_prompt_packet.py",
                [
                    "--profile",
                    str(profile_path),
                    "--keyword",
                    keyword,
                    "--article-type",
                    article_type,
                    "--platform",
                    platform,
                ],
            )
        return {"prompt": output}

    def guard(
        self,
        article: str,
        title: str,
        keyword: str,
        platform: str,
        industry: str,
    ) -> Dict[str, Any]:
        if platform not in {"toutiao", "sohu"}:
            raise WorkflowError("合规检查平台不受支持。")
        if industry not in {"general", "medical", "education", "finance", "legal"}:
            raise WorkflowError("行业类型不受支持。")

        with tempfile.TemporaryDirectory(prefix="geo-workbench-") as temp_dir:
            article_path = Path(temp_dir) / "article.md"
            article_path.write_text(article, encoding="utf-8")
            output = self._run(
                "platform_guard.py",
                [
                    "--platform",
                    platform,
                    "--industry",
                    industry,
                    "--keyword",
                    keyword,
                    "--title",
                    title,
                    "--article",
                    str(article_path),
                    "--format",
                    "json",
                ],
                allowed_codes=(0, 1),
            )
        return self._parse_json(output)

    def monitoring(
        self,
        profile: Mapping[str, Any],
        plan: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="geo-workbench-") as temp_dir:
            temp_root = Path(temp_dir)
            profile_path = temp_root / "profile.json"
            self._write_json(profile_path, profile)
            arguments = ["--profile", str(profile_path)]
            if plan:
                plan_path = temp_root / "plan.json"
                self._write_json(plan_path, plan)
                arguments.extend(["--plan", str(plan_path)])
            output = self._run("build_monitoring_plan.py", arguments)
        return self._parse_json(output)


RUNNER = WorkflowRunner()


class WorkbenchHandler(SimpleHTTPRequestHandler):
    """Static file handler plus a compact JSON API."""

    server_version = "GEOWorkbench/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(STATIC_ROOT), **kwargs)

    def log_message(self, format_string: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format_string % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self'; script-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
        )
        super().end_headers()

    def _send_json(self, payload: Mapping[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise WorkflowError("请求长度无效。") from exc
        if length <= 0 or length > MAX_BODY_BYTES:
            raise WorkflowError("请求为空或内容过大。")
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise WorkflowError("请求不是有效的 JSON。") from exc
        return _require_mapping(payload, "请求")

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/health":
            self._send_json({"ok": True, "data": {"status": "ready"}})
            return
        if self.path == "/api/template":
            try:
                self._send_json({"ok": True, "data": RUNNER.template()})
            except (OSError, json.JSONDecodeError) as exc:
                self._send_json(
                    {"ok": False, "error": f"模板读取失败：{exc}"},
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                )
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = self._read_json()
            profile = None
            if self.path in {"/api/diagnose", "/api/plan", "/api/prompt", "/api/monitoring"}:
                profile = _require_mapping(payload.get("profile"), "客户档案")

            if self.path == "/api/diagnose":
                result = RUNNER.diagnose(profile or {})
            elif self.path == "/api/plan":
                result = RUNNER.plan(profile or {})
            elif self.path == "/api/prompt":
                result = RUNNER.prompt(
                    profile or {},
                    _require_text(payload.get("keyword"), "目标关键词"),
                    _require_text(payload.get("article_type"), "文章类型"),
                    _require_text(payload.get("platform"), "目标平台"),
                )
            elif self.path == "/api/guard":
                result = RUNNER.guard(
                    _require_text(payload.get("article"), "文章正文"),
                    _require_text(payload.get("title"), "文章标题"),
                    _require_text(payload.get("keyword", ""), "目标关键词", allow_empty=True),
                    _require_text(payload.get("platform"), "目标平台"),
                    _require_text(payload.get("industry"), "行业类型"),
                )
            elif self.path == "/api/monitoring":
                raw_plan = payload.get("plan")
                plan = _require_mapping(raw_plan, "关键词计划") if raw_plan else None
                result = RUNNER.monitoring(profile or {}, plan)
            else:
                self._send_json({"ok": False, "error": "接口不存在。"}, HTTPStatus.NOT_FOUND)
                return
            self._send_json({"ok": True, "data": result})
        except WorkflowError as exc:
            self._send_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # pragma: no cover - defensive server boundary
            print(f"Unexpected server error: {exc!r}", file=sys.stderr)
            self._send_json(
                {"ok": False, "error": "处理失败，请检查输入后重试。"},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )


def build_server(host: str, port: int) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), WorkbenchHandler)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the local GEO automation workbench.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host. Defaults to localhost only.")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on.")
    parser.add_argument("--open", action="store_true", help="Open the workbench in the default browser.")
    args = parser.parse_args()

    server = build_server(args.host, args.port)
    url = f"http://{args.host}:{server.server_address[1]}"
    print(f"GEO 自动化工作台已启动：{url}")
    print("按 Ctrl+C 停止。")
    if args.open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n工作台已停止。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
