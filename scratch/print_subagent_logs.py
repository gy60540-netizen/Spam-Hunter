import json
import os

transcript_path = r"C:\Users\shrey\.gemini\antigravity-ide\brain\96f1fc9b-57e7-4564-9cd1-718b891f9fa4\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(transcript_path):
    print("Found transcript")
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            if "capture_browser_console_logs" in line or "console" in line:
                try:
                    data = json.loads(line)
                    # Look for SYSTEM type responses to capture_browser_console_logs
                    if data.get("source") == "SYSTEM" and "logs" in data.get("content", "").lower():
                        print("Step Index:", data.get("step_index"))
                        print("Content:")
                        print(data.get("content"))
                        print("=" * 60)
                except Exception as e:
                    pass
else:
    print("Transcript not found")
