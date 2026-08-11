import json
import os

transcript_path = r"C:\Users\shrey\.gemini\antigravity-ide\brain\96f1fc9b-57e7-4564-9cd1-718b891f9fa4\.system_generated\logs\transcript_full.jsonl"

if os.path.exists(transcript_path):
    print("Found transcript")
    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            if '"toolSummary":"Inspecting local site"' in line or '"toolName":"browser_subagent"' in line:
                try:
                    data = json.loads(line)
                    print("Step Index:", data.get("step_index"))
                    print("Tool Calls:", json.dumps(data.get("tool_calls"), indent=2))
                    print("-" * 50)
                except Exception as e:
                    pass
else:
    print("Transcript not found")
