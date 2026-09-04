#!/usr/bin/env python3
"""Install this repository's skills into a Codex skills directory safely."""

from __future__ import annotations

import argparse
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Iterable, List


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "skills"


def available_skills() -> List[str]:
    return sorted(path.name for path in SOURCE_ROOT.iterdir() if (path / "SKILL.md").is_file())


def default_target() -> Path:
    configured_root = os.environ.get("CODEX_HOME")
    codex_root = Path(configured_root).expanduser() if configured_root else Path.home() / ".codex"
    return codex_root / "skills"


def install(selected: Iterable[str], target: Path, force: bool) -> int:
    known = set(available_skills())
    target.mkdir(parents=True, exist_ok=True)
    installed = 0

    for name in selected:
        if name not in known:
            raise ValueError(f"未知 Skill：{name}")
        source = SOURCE_ROOT / name
        destination = target / name

        if destination.exists():
            if not force:
                print(f"跳过 {name}：目标已存在（如需更新请加 --force）。")
                continue
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup = target / f"{name}.backup-{timestamp}"
            counter = 1
            while backup.exists():
                backup = target / f"{name}.backup-{timestamp}-{counter}"
                counter += 1
            destination.rename(backup)
            print(f"已备份原版本：{backup}")

        shutil.copytree(source, destination)
        print(f"已安装 {name} -> {destination}")
        installed += 1

    return installed


def main() -> int:
    parser = argparse.ArgumentParser(description="Install the bundled Codex skills.")
    parser.add_argument(
        "--target",
        type=Path,
        default=default_target(),
        help="Skills directory. Defaults to $CODEX_HOME/skills or ~/.codex/skills.",
    )
    parser.add_argument("--skill", action="append", dest="skills", help="Install one named skill. Repeatable.")
    parser.add_argument("--force", action="store_true", help="Back up and replace skills that already exist.")
    parser.add_argument("--list", action="store_true", help="List the bundled skills and exit.")
    args = parser.parse_args()

    names = available_skills()
    if args.list:
        print("\n".join(names))
        return 0

    selected = args.skills or names
    count = install(selected, args.target.expanduser().resolve(), args.force)
    print(f"完成：本次安装 {count} 个 Skill。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
