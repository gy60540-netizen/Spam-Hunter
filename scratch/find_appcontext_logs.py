import json
import os

transcript_path = r"C:\Users\shrey\.gemini\antigravity-ide\brain\96f1fc9b-57e7-4564-9cd1-718b891f9fa4\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(transcript_path):
    print("Found transcript")
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            if "[AppContext]" in line:
                try:
                    data = json.loads(line)
                    print("Step Index:", data.get("step_index"))
                    print("Source:", data.get("source"))
                    print("Type:", data.get("type"))
                    content = data.get("content", "")
                    # print lines containing AppContext
                    for l in content.split("\n"):
                        if "[AppContext]" in l or "console" in l or "fetch" in l:
                            print("  ", l[:200])
                    print("-" * 50)
                except Exception as e:
                    pass
else:
    print("Transcript not found")
