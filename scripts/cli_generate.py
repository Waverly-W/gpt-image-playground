#!/usr/bin/env python3
"""
CLI & Python SDK for local GPT Image Playground (Port 3005)
Supports text-to-image and image-to-image with polling and local/CDN output.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

DEFAULT_BASE_URL = os.environ.get("GPT_IMAGE_PLAYGROUND_URL", "http://127.0.0.1:3005")
DEFAULT_ADMIN_EMAIL = os.environ.get("GPT_IMAGE_ADMIN_EMAIL", "admin@example.com")
DEFAULT_ADMIN_PASSWORD = os.environ.get("GPT_IMAGE_ADMIN_PASSWORD", "a52zQ=HDujXXjkbV+1h@zfOx")
CDN_BASE_URL = "https://pic.waverlywang.top"


class ImagePlaygroundClient:
    def __init__(self, base_url: str = DEFAULT_BASE_URL, email: str = DEFAULT_ADMIN_EMAIL, password: str = DEFAULT_ADMIN_PASSWORD):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.cookie = None

    def login(self) -> None:
        """Authenticate with the local service to obtain session cookie."""
        login_url = f"{self.base_url}/api/auth/login"
        payload = json.dumps({"email": self.email, "password": self.password}).encode("utf-8")
        req = urllib.request.Request(
            login_url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                self.cookie = resp.headers.get("Set-Cookie")
                if not self.cookie:
                    raise RuntimeError("No Set-Cookie header received upon login.")
        except Exception as exc:
            raise RuntimeError(f"Failed to login to {self.base_url}: {exc}")

    def _ensure_login(self) -> None:
        if not self.cookie:
            self.login()

    def generate(
        self,
        prompt: str,
        mode: str = "generate",
        model: str = "gpt-image-2",
        image_path: str | None = None,
        n: int = 1,
        size: str = "1024x1024",
        output_format: str = "png",
        timeout: int = 180,
        poll_interval: float = 2.0,
    ) -> dict:
        """
        Submit image generation or edit task and poll until complete.
        Returns dict containing job details and image URLs (both local and CDN).
        """
        self._ensure_login()

        boundary = f"----WebKitBoundary{int(time.time()*1000)}"
        lines = []

        def add_field(name: str, value: str):
            lines.append(f"--{boundary}".encode("utf-8"))
            lines.append(f'Content-Disposition: form-data; name="{name}"\r\n'.encode("utf-8"))
            lines.append(str(value).encode("utf-8"))

        add_field("mode", mode)
        add_field("model", model)
        add_field("prompt", prompt)
        add_field("n", str(n))
        add_field("size", size)
        add_field("output_format", output_format)

        if image_path and os.path.exists(image_path):
            filename = os.path.basename(image_path)
            content_type = "image/png" if filename.lower().endswith(".png") else "image/jpeg"
            lines.append(f"--{boundary}".encode("utf-8"))
            lines.append(f'Content-Disposition: form-data; name="image"; filename="{filename}"'.encode("utf-8"))
            lines.append(f"Content-Type: {content_type}\r\n".encode("utf-8"))
            with open(image_path, "rb") as f:
                lines.append(f.read())

        lines.append(f"--{boundary}--\r\n".encode("utf-8"))
        body = b"\r\n".join(lines)

        headers: dict[str, str] = {
            "Cookie": self.cookie or "",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        }
        req = urllib.request.Request(
            f"{self.base_url}/api/image-jobs",
            data=body,
            headers=headers
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            job = data.get("job")
            if not job or "id" not in job:
                raise RuntimeError(f"Unexpected response creating job: {data}")
            job_id = job["id"]

        start_time = time.time()
        while time.time() - start_time < timeout:
            time.sleep(poll_interval)
            status_headers: dict[str, str] = {"Cookie": self.cookie or ""}
            status_req = urllib.request.Request(
                f"{self.base_url}/api/image-jobs/{job_id}",
                headers=status_headers
            )
            with urllib.request.urlopen(status_req, timeout=15) as sresp:
                sdata = json.loads(sresp.read().decode("utf-8"))
                current_job = sdata.get("job", {})
                status = current_job.get("status")

                if status == "completed":
                    images = current_job.get("images", [])
                    results = []
                    for img in images:
                        rel_path = img.get("path", "")
                        filename = rel_path.split("/")[-1] if "/" in rel_path else rel_path
                        results.append({
                            "local_api_url": f"{self.base_url}{rel_path}",
                            "cdn_url": f"{CDN_BASE_URL}/{filename}",
                            "filename": filename,
                            "file_size": img.get("fileSize")
                        })
                    return {
                        "job_id": job_id,
                        "status": "completed",
                        "duration_ms": current_job.get("durationMs"),
                        "images": results
                    }
                elif status == "failed":
                    raise RuntimeError(f"Job {job_id} failed: {current_job.get('error')}")

        raise TimeoutError(f"Job {job_id} timed out after {timeout} seconds")


def main():
    parser = argparse.ArgumentParser(description="CLI client for local GPT Image Playground")
    parser.add_argument("-p", "--prompt", required=True, help="Image prompt")
    parser.add_argument("-m", "--mode", default="generate", choices=["generate", "edit"], help="Generation mode")
    parser.add_argument("-i", "--image", help="Input image for edit/image-to-image")
    parser.add_argument("-s", "--size", default="1024x1024", help="Image size, e.g. 1024x1024, 1536x1024")
    parser.add_argument("-o", "--output", help="Save first result to local file path")
    parser.add_argument("--url", default=DEFAULT_BASE_URL, help="Base URL of image playground")
    args = parser.parse_args()

    client = ImagePlaygroundClient(base_url=args.url)
    print(f"Submitting {args.mode} job to {args.url}...", file=sys.stderr)
    try:
        res = client.generate(
            prompt=args.prompt,
            mode=args.mode,
            image_path=args.image,
            size=args.size
        )
        print(f"Job finished in {res['duration_ms']/1000:.1f}s!", file=sys.stderr)
        for i, img in enumerate(res["images"]):
            print(f"Image [{i}]:")
            print(f"  CDN: {img['cdn_url']}")
            print(f"  Local API: {img['local_api_url']}")

        if args.output and res["images"]:
            first_url = res["images"][0]["cdn_url"]
            print(f"Saving image to {args.output}...", file=sys.stderr)
            urllib.request.urlretrieve(first_url, args.output)
            print(f"Saved successfully: {args.output}", file=sys.stderr)

        print(json.dumps(res, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
