import os

sys_dir = r"C:\Users\shrey\.gemini\antigravity-ide\brain\96f1fc9b-57e7-4564-9cd1-718b891f9fa4\.system_generated"

if os.path.exists(sys_dir):
    print("Found .system_generated")
    for root, dirs, files in os.walk(sys_dir):
        print("Root:", root)
        print("Dirs:", dirs)
        print("Files:", files[:20])
        print("-" * 50)
else:
    print(".system_generated not found")
