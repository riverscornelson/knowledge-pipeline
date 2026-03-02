"""Read-only assessment of PDFs in the Drive folder for pipeline planning."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import DriveConfig
from src.drive_client import DriveClient


def main():
    config = DriveConfig.from_env()
    drive = DriveClient(config)

    # Get all files with size info
    query = (
        f"'{drive.folder_id}' in parents and trashed=false "
        f"and mimeType='application/pdf'"
    )
    response = drive.service.files().list(
        q=query,
        fields="files(id, name, size, createdTime)",
        pageSize=1000,
    ).execute()
    files = response.get("files", [])

    sizes = [int(f.get("size", 0)) for f in files]
    names = [f["name"] for f in files]
    dates = [f.get("createdTime", "")[:10] for f in files]

    print(f"Total PDFs: {len(files)}")
    print(f"Total size: {sum(sizes) / (1024*1024):.1f} MB")
    print(f"Avg size: {sum(sizes) / max(len(sizes),1) / 1024:.1f} KB")
    print(f"Min size: {min(sizes) / 1024:.1f} KB")
    print(f"Max size: {max(sizes) / (1024*1024):.2f} MB")
    print(f"Upload dates: {min(dates)} to {max(dates)}")

    # Size distribution
    buckets = {"<100KB": 0, "100KB-1MB": 0, "1MB-10MB": 0, ">10MB": 0}
    for s in sizes:
        if s < 100_000:
            buckets["<100KB"] += 1
        elif s < 1_000_000:
            buckets["100KB-1MB"] += 1
        elif s < 10_000_000:
            buckets["1MB-10MB"] += 1
        else:
            buckets[">10MB"] += 1
    print(f"\nSize distribution: {json.dumps(buckets, indent=2)}")

    # Sample of filenames
    print(f"\nSample filenames (first 15):")
    for n in sorted(names)[:15]:
        print(f"  {n}")
    print(f"  ...")
    for n in sorted(names)[-5:]:
        print(f"  {n}")

    # Check for very large files that might cause issues
    large = [(f["name"], int(f.get("size", 0)) / (1024*1024))
             for f in files if int(f.get("size", 0)) > 5_000_000]
    if large:
        print(f"\nLarge files (>5MB) that may slow extraction:")
        for name, mb in sorted(large, key=lambda x: -x[1]):
            print(f"  {mb:.1f} MB  {name}")


if __name__ == "__main__":
    main()
