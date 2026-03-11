#!/usr/bin/env python3
"""List installed Android apps with their display names via ADB + androguard.

Usage:
  python3 scripts/list-android-apps.py [--all]

Output: JSON array of {packageName, appName, isSystemApp}
Requires: androguard (pip install androguard), adb
"""

import json
import os
import subprocess
import sys
import tempfile
import logging

# Suppress androguard's verbose logging
logging.disable(logging.CRITICAL)

def get_packages(user_only: bool) -> tuple[list[str], set[str]]:
    """Get package lists. Returns (target_packages, user_packages_set)."""
    r = subprocess.run(
        ["adb", "shell", "pm", "list", "packages", "-3"],
        capture_output=True, text=True, timeout=15
    )
    user_pkgs = set(
        line.replace("package:", "").strip()
        for line in r.stdout.strip().split("\n") if line.strip()
    )

    if user_only:
        return sorted(user_pkgs), user_pkgs

    r2 = subprocess.run(
        ["adb", "shell", "pm", "list", "packages"],
        capture_output=True, text=True, timeout=15
    )
    all_pkgs = sorted(
        line.replace("package:", "").strip()
        for line in r2.stdout.strip().split("\n") if line.strip()
    )
    return all_pkgs, user_pkgs


def get_app_name(pkg: str, tmp_dir: str) -> str:
    """Get app display name by pulling APK and parsing with androguard."""
    try:
        from androguard.core.apk import APK

        # Get APK path on device
        r = subprocess.run(
            ["adb", "shell", f"pm path {pkg}"],
            capture_output=True, text=True, timeout=10
        )
        apk_device_path = r.stdout.strip().split("\n")[0].replace("package:", "")
        if not apk_device_path:
            return ""

        # Pull base APK
        tmp_apk = os.path.join(tmp_dir, f"{pkg}.apk")
        subprocess.run(
            ["adb", "pull", apk_device_path, tmp_apk],
            capture_output=True, timeout=30
        )

        a = APK(tmp_apk)
        name = a.get_app_name()
        os.unlink(tmp_apk)
        return name or ""
    except Exception:
        return ""


def main():
    user_only = "--all" not in sys.argv
    packages, user_set = get_packages(user_only)

    results = []
    tmp_dir = tempfile.mkdtemp(prefix="apk_")

    for pkg in packages:
        name = get_app_name(pkg, tmp_dir)
        results.append({
            "packageName": pkg,
            "appName": name or pkg,
            "isSystemApp": pkg not in user_set,
        })
        # Progress to stderr
        print(f"  {pkg} -> {name or '(unknown)'}", file=sys.stderr)

    # Clean up temp dir
    try:
        os.rmdir(tmp_dir)
    except OSError:
        pass

    json.dump(results, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
